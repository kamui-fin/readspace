import React from "react";
import { SvgXml, type SvgProps } from "react-native-svg";

const LocalPlusIcon = (props: Omit<SvgProps, "xml">) => {
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" d="M15 12h-3m0 0H9m3 0V9m0 3v3"/></g></svg>`;

  return <SvgXml xml={xml} {...props} />;
};

export default LocalPlusIcon;
