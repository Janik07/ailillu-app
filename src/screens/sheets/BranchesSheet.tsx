import { plural } from '../../domain/format';
import { distanceKm, distanceLabel, type Point } from '../../domain/geo';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { useChain } from '../../store/data';
import { Icon } from '../../ui/Icon';
import { ChainThumb, Sheet } from '../../ui/parts';
import './sheets.css';

export function BranchesSheet({ chainId }: { chainId: string }) {
  const nav = useNav();
  const chain = useChain(chainId);
  const me = useApp((s) => s.me);
  if (!chain) return null;

  const rows = chain.branches
    .map((branch, index) => ({ branch, index, km: me && branch.lat != null ? distanceKm(me, branch as Point) : null }))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  return (
    <Sheet onClose={nav.pop} label={chain.title}>
      <div className="pad row branches-head">
        <ChainThumb chain={chain} size={52} />
        <div>
          <div className="h2">{chain.title}</div>
          <div className="small muted">
            {chain.type} · {chain.branches.length} {plural(chain.branches.length, 'точка', 'точки', 'точек')}
          </div>
        </div>
      </div>
      <div className="scroll pad sheet-body">
        {rows.map(({ branch, index, km }, position) => (
          <button
            key={branch.slug}
            className="list-row"
            onClick={() => nav.replaceTop({ type: 'venue', chain: chain.id, branch: index })}
          >
            <span className={`branch-mark${position === 0 && km != null ? ' on' : ''}`}>
              <Icon name="pin" size={18} />
            </span>
            <div className="grow">
              <div className="strong">{branch.short}</div>
              <div className="small muted">{branch.address}</div>
              {branch.hours && <div className="small muted">{branch.hours}</div>}
            </div>
            {km != null && <span className="small strong">{distanceLabel(km).split(' · ')[0]}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
