// 버전 비교 (design.md 데이터 흐름 「명세화」): 점으로 나눈 세 자리를 각각 정수로 비교한다
const parse = (v: string): [number, number, number] => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new Error(`버전을 읽을 수 없다: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

export function atLeast(have: string, want: string): boolean {
  const h = parse(have);
  const w = parse(want);
  for (let i = 0; i < 3; i++) {
    if (h[i] !== w[i]) return h[i] > w[i];
  }
  return true;
}
