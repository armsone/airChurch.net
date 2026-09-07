export type LogoPalette = [number, number, number];

// 외부 로고가 CORS로 색상 읽기를 막아도 안정적으로 적용할 수 있는 팔레트입니다.
export const churchLogoPalettes: Readonly<Record<string,LogoPalette>> = {
  "거룩한빛광성교회": [38, 104, 151],
};

export const denominationLogoPalettes: Readonly<Record<string,LogoPalette>> = {
  "대한예수교장로회 통합": [34, 113, 72],
  "한국기독교장로회": [52, 68, 143],
  "기독교대한감리회": [31, 93, 154],
  "기독교한국침례회": [30, 91, 137],
};
