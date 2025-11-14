import type { CustomToastOptions } from 'burnt/build/types';
import type { JSX } from 'react';

export type ValueFunction<TValue, TArg> = (arg: TArg) => TValue;
export type ValueOrFunction<TValue, TArg> = TValue | ValueFunction<TValue, TArg>;

export type CustomOption = {
  ios: CustomToastOptions['icon']['ios'];
  web: JSX.Element | React.ReactNode;
  duration?: number;
};
