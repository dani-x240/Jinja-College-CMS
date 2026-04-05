import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export default function ReportDebug() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [inserting, setInserting] = useState(false);
  const [insertResult, setInsertResult] = useState(null);

  useEffect(() => {
    const runChecks = async () => {
      setLoading(true);
      const r = [];
      const e = [];

      try {
        const res = await supabase.schema('public').from('lesson_reports').select('id').limit(1);
        r.push({ label: 'schema public -> lesson_reports select', ok: !res.error, data: res.data, error: res.error?.message });
      } catch (err) {
        e.push({ label: 'schema select exception', message: err.message || String(err) });
      }

      try {
        const res2 = await supabase.from('lesson_reports').select('id').limit(1);
        r.push({ label: 'default search_path -> lesson_reports select', ok: !res2.error, data: res2.data, error: res2.error?.message });
      } catch (err) {
        e.push({ label: 'fallback select exception', message: err.message || String(err) });
      }

      try {
        const toReg = await supabase.rpc('pg_to_regclass', { name: 'public.lesson_reports' });
        r.push({ label: 'rpc to_regclass (custom)', ok: !toReg.error, data: toReg.data, error: toReg.error?.message });
      } catch (err) {
        r.push({ label: 'rpc to_regclass not available via RPC', ok: false, data: null, error: err.message || String(err) });
      }

      setResults(r);
      setErrors(e);
      setLoading(false);
    };

    runChecks();
  }, []);

  const testInsert = async () => {
    setInserting(true);
    setInsertResult(null);
    try {
      const payload = {
        teacher_id: 12345,
        teacher_name: 'Client Test',
        student_id: 12345,
        student_name: 'Client Test Student',
        class_name: 'TestClass',
        subject: 'Debug',
        lesson_notes: 'Inserted from client debug panel',
        participation: 'Good',
        report_date: new Date().toISOString().split('T')[0]
      };

      const res = await supabase.from('lesson_reports').insert(payload).select('*');
      setInsertResult({ ok: !res.error, data: res.data, error: res.error?.message });
    } catch (err) {
      setInsertResult({ ok: false, error: err.message || String(err) });
    }
    setInserting(false);
  };

  return (
    <div className="card" style={{ padding: '16px' }}>
      <h3 style={{ marginTop: 0 }}>Report DB Debug</h3>
      {loading && <div>Running checks...</div>}

      {!loading && (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <button className="btn-primary" onClick={testInsert} disabled={inserting} style={{ padding: '8px 12px', marginBottom: '8px' }}>
              {inserting ? 'Testing insert...' : 'Test Insert (client)'}
            </button>
            {insertResult && (
              <div style={{ padding: '8px', borderRadius: '8px', background: insertResult.ok ? '#ecfdf5' : '#fff1f2', border: '1px solid #e6e6e6' }}>
                <div style={{ fontWeight: 600 }}>{insertResult.ok ? 'Insert OK' : 'Insert ERROR'}</div>
                {insertResult.error && <div style={{ color: '#991b1b', marginTop: '6px' }}>{insertResult.error}</div>}
                {insertResult.data && <pre style={{ marginTop: '8px', maxHeight: '140px', overflow: 'auto' }}>{JSON.stringify(insertResult.data, null, 2)}</pre>}
              </div>
            )}
          </div>
          {results.map((r, i) => (
            <div key={i} style={{ padding: '10px', borderRadius: '8px', background: r.ok ? '#ecfdf5' : '#fff1f2', border: '1px solid #e6e6e6' }}>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontSize: '13px', color: '#374151' }}>{r.ok ? 'OK' : 'ERROR'}</div>
              {r.error && <div style={{ marginTop: '6px', color: '#991b1b', fontSize: '13px' }}>{r.error}</div>}
              {r.data && <pre style={{ marginTop: '8px', maxHeight: '140px', overflow: 'auto' }}>{JSON.stringify(r.data, null, 2)}</pre>}
            </div>
          ))}

          {errors.length > 0 && (
            <div style={{ padding: '10px', borderRadius: '8px', background: '#fff7ed', border: '1px solid #fdba74' }}>
              <div style={{ fontWeight: 600 }}>Exceptions</div>
              {errors.map((err, i) => (
                <div key={i} style={{ marginTop: '6px', fontSize: '13px', color: '#92400e' }}>{err.label}: {err.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
