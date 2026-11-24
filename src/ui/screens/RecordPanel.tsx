import { useState } from 'react';
import { roleLabel } from '../format';
import { RECORD_ROLES, clearRecord, rate, type MyRecord, type RecordRole } from '../record';
import type { Role, Special } from '../../engine/types';

const SPECIAL_BASE: Partial<Record<RecordRole, Role>> = { navigator: 'loyalist', doubleAgent: 'rebel' };
export const recordRoleName = (r: RecordRole): string => {
  const base = SPECIAL_BASE[r];
  return base ? roleLabel(base, r as Special) : roleLabel(r as Role);
};

/** 시작 화면의 내 전적 창: 통산·연승·역할별 승률, 초기화 */
export function RecordPanel({ record, onChange, onClose }: { record: MyRecord; onChange: (r: MyRecord) => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const rows = RECORD_ROLES.filter((r) => record.byRole[r]?.games);
  return (
    <div className="record-backdrop" onClick={onClose}>
      <div className="scroll-panel record-panel" role="dialog" aria-label="내 전적" onClick={(e) => e.stopPropagation()}>
        <h2>📜 내 전적</h2>
        {record.games === 0 ? (
          <p>아직 끝까지 한 판이 없어요. 한 판 끝내면 여기에 쌓여요.</p>
        ) : (
          <>
            <p className="record-total">
              <b>
                {record.games}전 {record.wins}승
              </b>{' '}
              ({rate(record)}) · 🔥 최고 {record.bestStreak}연승
              {record.streak > 0 && ` · 지금 ${record.streak}연승 중`}
            </p>
            <table className="record-table">
              <thead>
                <tr>
                  <th>역할</th>
                  <th>판</th>
                  <th>승</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r}>
                    <td>{recordRoleName(r)}</td>
                    <td>{record.byRole[r]!.games}</td>
                    <td>{record.byRole[r]!.wins}</td>
                    <td>{rate(record.byRole[r]!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="setup-actions">
          {record.games > 0 &&
            (confirm ? (
              <button type="button" className="secondary danger" onClick={() => (onChange(clearRecord()), setConfirm(false))}>
                정말 지울까요?
              </button>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirm(true)}>
                초기화
              </button>
            ))}
          <button type="button" className="primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
