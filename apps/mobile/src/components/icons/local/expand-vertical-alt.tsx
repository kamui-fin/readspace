import React from "react";
import { SvgXml, type SvgProps } from "react-native-svg";

const LocalExpandVerticalAltIcon = (props: Omit<SvgProps, "xml">) => {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="m136 208l120-104l120 104m-240 96l120 104l120-104"/></svg>`;

  return <SvgXml xml={xml} {...props} />;
};

export default LocalExpandVerticalAltIcon;
