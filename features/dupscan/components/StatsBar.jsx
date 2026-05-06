'use client';
import { Layers, CopyX, HardDrive, Shield, Eye, Bookmark, Trash2 } from 'lucide-react';
import { fmtSize } from '../../../shared/utils/formatters';

const ITEMS = [
  {key:'sets',    icon:<Layers size={12}/>,    label:'Groups',   color:'var(--neon)'},
  {key:'extra',   icon:<CopyX size={12}/>,     label:'Extra',    color:'#f59e0b'},
  {key:'waste',   icon:<HardDrive size={12}/>, label:'Wasted',   color:'#ef4444', fmt:true},
  {key:'keep',    icon:<Shield size={12}/>,    label:'Keep',     color:'#22c55e'},
  {key:'review',  icon:<Eye size={12}/>,       label:'Review',   color:'#3b82f6'},
  {key:'need',    icon:<Bookmark size={12}/>,  label:'Need',     color:'#a855f7'},
  {key:'deleted', icon:<Trash2 size={12}/>,    label:'Deleted',  color:'#6b7280'},
];

export default function StatsBar({ stats }) {
  return (
    <div className="flex items-stretch flex-shrink-0" style={{background:'var(--s1)',borderBottom:'2px solid var(--border)'}}>
      {ITEMS.map((item,i)=>(
        <div key={item.key}
          className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-0"
          style={{borderRight:i<ITEMS.length-1?'1px solid var(--border)':'none'}}>
          <span style={{color:item.color,flexShrink:0}}>{item.icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-black mono leading-none" style={{color:item.color}}>
              {item.fmt ? fmtSize(stats[item.key]||0) : (stats[item.key]||0)}
            </div>
            <div className="text-xs leading-none mt-0.5 font-medium" style={{color:'var(--dim)',fontSize:'9px',letterSpacing:'.06em'}}>
              {item.label.toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
