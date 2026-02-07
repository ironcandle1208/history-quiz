// TypeScript が CSS import を理解できるようにする。
// NOTE: Remix 側で CSS はビルドされるため、型だけを補う。

declare module "*.css" {
  const content: string;
  export default content;
}

