export type LogoColor = [number, number, number];
export type LogoPalette = {
  primary: LogoColor;
  secondary: LogoColor;
  accent: LogoColor;
};

// 외부 로고가 CORS로 색상 읽기를 막아도 안정적으로 적용할 수 있는 팔레트입니다.
export const churchLogoPalettes: Readonly<Record<string,LogoPalette>> = {
  "거룩한빛광성교회": { primary: [38, 104, 151], secondary: [232, 116, 45], accent: [222, 67, 91] },
};

export const denominationLogoPalettes: Readonly<Record<string,LogoPalette>> = {
  "대한예수교장로회 통합": { primary: [34, 113, 72], secondary: [184, 43, 43], accent: [237, 177, 48] },
  "한국기독교장로회": { primary: [52, 68, 143], secondary: [115, 67, 155], accent: [237, 237, 237] },
  "기독교대한감리회": { primary: [31, 93, 154], secondary: [220, 57, 54], accent: [237, 178, 54] },
  "기독교한국침례회": { primary: [30, 91, 137], secondary: [217, 75, 62], accent: [243, 178, 55] },
};
