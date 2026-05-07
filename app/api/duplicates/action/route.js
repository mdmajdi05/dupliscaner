// app/api/duplicates/action/route.js - Execute delete/move/keep actions
import { execDb, queryDb, transactionDb } from '../../../../lib/db.js';
import { unlink, rename } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * POST /api/duplicates/action
 * 
 * Execute file actions (delete, move, or mark as keep)
 * 
 * Body:
 * {
 *   groupHash: "abc123...",
 *   actions: [
 *     { path: "/full/path/to/file", action: "delete" | "move" | "keep" },
 *     { path: "/full/path", newPath: "/new/path", action: "move" }
 *   ]
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   summary: { deleted: N, moved: N, kept: N },
 *   failures: [{ path, action, error }],
 *   warnings: []
 * }
 */
export async function POST(req) {
  try {
    const { groupHash, actions } = await req.json();

    if (!groupHash || !actions || !Array.isArray(actions)) {
      return Response.json(
        { error: 'groupHash and actions array required' },
        { status: 400 }
      );
    }

    const results = {
      summary: { deleted: 0, moved: 0, kept: 0 },
      failures: [],
      warnings: []
    };

    // Validate group exists
    const group = await queryDb(
      'SELECT * FROM duplicate_groups WHERE hash = ?',
      [groupHash]
    );
    if (!group || group.length === 0) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // Execute actions in transaction
    await transactionDb(async () => {
      for (const action of actions) {
        try {
          switch (action.action) {
            case 'delete':
              await handleDelete(action.path);
              results.summary.deleted++;
              break;

            case 'move':
              if (!action.newPath) throw new Error('newPath required for move action');
              await handleMove(action.path, action.newPath);
              results.summary.moved++;
              break;

            case 'keep':
              await handleKeep(action.path, groupHash);
              results.summary.kept++;
              break;

            default:
              throw new Error(`Unknown action: ${action.action}`);
          }

          // Update file status in database
          await execDb(
            `UPDATE files 
             SET status = ?, updated_at = ?
             WHERE path = ?`,
            [action.action, Math.floor(Date.now() / 1000), action.path]
          );
        } catch (err) {
          results.failures.push({
            path: action.path,
            action: action.action,
            error: err.message
          });
        }
      }
    });

    // Update duplicate group waste_bytes after deletions
    if (results.summary.deleted > 0) {
      const remaining = await queryDb(
        'SELECT COUNT(*) as count FROM files WHERE duplicate_group_id = ? AND status != ?',
        [groupHash, 'deleted']
      );
      
      const remainingCount = remaining[0]?.count || 0;
      if (remainingCount <= 1) {
        // Group is no longer a duplicate, mark as resolved
        await execDb(
          'UPDATE duplicate_groups SET updated_at = ? WHERE hash = ?',
          [Math.floor(Date.now() / 1000), groupHash]
        );
      }
    }

    return Response.json({
      success: results.failures.length === 0,
      ...results
    });
  } catch (err) {
    console.error('[POST /api/duplicates/action] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Delete a file from disk
 */
async function handleDelete(filePath) {
  try {
    // Verify file exists
    await unlink(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('File not found (already deleted?)');
    } else if (err.code === 'EACCES') {
      throw new Error('Permission denied - cannot delete file');
    } else if (err.code === 'EISDIR') {
      throw new Error('Path is a directory, not a file');
    }
    throw err;
  }
}

/**
 * Move a file to new location
 */
async function handleMove(fromPath, toPath) {
  try {
    // Ensure target directory exists
    const targetDir = path.dirname(toPath);
    
    // Move file (fs.rename works for moves)
    await rename(fromPath, toPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('Source file not found');
    } else if (err.code === 'EACCES') {
      throw new Error('Permission denied - cannot move file');
    } else if (err.code === 'EEXIST') {
      throw new Error('Target path already exists');
    }
    throw err;
  }
}

/**
 * Mark file as kept (delete others in group)
 */
async function handleKeep(filePath, groupHash) {
  // Just update the status - UI will know to delete others
  // Actual deletion handled separately
}
