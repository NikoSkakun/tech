/**
 * Dense linear solve A·x = b by Gaussian elimination with partial pivoting (circuits here have ≤ ~30
 * unknowns — `current` «Модель симуляції» §7). Returns `null` when the matrix is (numerically) singular.
 */
export function solveLinear(matrix: readonly (readonly number[])[], rhs: readonly number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row) => row.slice());
  const b = rhs.slice();
  let scale = 0;
  for (const row of a) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const tol = (scale || 1) * 1e-15;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best <= tol) return null;
    if (pivot !== col) {
      [a[pivot], a[col]] = [a[col], a[pivot]];
      [b[pivot], b[col]] = [b[col], b[pivot]];
    }
    const prow = a[col];
    const pv = prow[col];
    for (let r = col + 1; r < n; r++) {
      const row = a[r];
      const f = row[col] / pv;
      if (f === 0) continue;
      for (let c = col; c < n; c++) row[c] -= f * prow[c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    const row = a[r];
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= row[c] * x[c];
    x[r] = s / row[r];
  }
  return x;
}
