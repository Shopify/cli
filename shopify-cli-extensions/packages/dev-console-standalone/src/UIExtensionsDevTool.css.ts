import {style, globalStyle} from '@vanilla-extract/css';

import {border, color, font} from './theme.css';

export const OuterContainer = style({
  height: '100vh',
  background: color.background,
  overflow: 'auto',
});

export const Hidden = style({visibility: 'hidden'});

export const DevTool = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  color: color.text,
  fontFamily: font,

  overflow: 'hidden',
  borderTopLeftRadius: border.radius,
  borderTopRightRadius: border.radius,
});

globalStyle(`${DevTool} h1`, {fontWeight: 700});
globalStyle(`${DevTool} main`, {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});
globalStyle(`${DevTool} svg`, {width: '2rem'});

export const Header = style({
  borderBottom: `1px solid ${color.dark}`,
  display: 'flex',
  justifyContent: 'space-between',
  padding: '1.5rem 2rem 1rem',
});

globalStyle(`${Header} svg`, {fill: color.text});

export const Cancel = style({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
});

export const HeaderLeft = style({
  display: 'flex',
  height: 'auto',
});

export const SideBar = style({
  background: color.dark,
  width: '24rem',
});

globalStyle(`${SideBar} ul`, {
  listStyle: 'none',
  padding: 0,
});
globalStyle(`${SideBar} svg`, {fill: color.text});

export const MenuItem = style({
  position: 'relative',
  margin: '0.5rem 1rem',
  padding: '0.5rem 1rem',
  borderRadius: border.radius,
  display: 'flex',
  alignItems: 'center',
});

globalStyle(`${MenuItem}:focus, ${MenuItem}:hover`, {
  background: color.background,
  color: color.active,
  cursor: 'pointer',
});
globalStyle(`${MenuItem}:focus::before, ${MenuItem}:hover::before`, {
  content: '',
  position: 'absolute',
  left: '-1rem',
  width: '3px',
  height: '3rem',
  background: color.active,
  borderRadius: '4px',
  marginRight: '1rem',
});
globalStyle(`${MenuItem}:focus svg, ${MenuItem}:hover svg`, {fill: color.active});

export const ExtensionList = style({
  width: '100%',
  overflow: 'auto',
  flex: 1,
});

globalStyle(`${ExtensionList} table`, {
  textAlign: 'left',
  width: '100%',
  borderCollapse: 'collapse',
});
globalStyle(`${ExtensionList} hr`, {color: color.subdued});
globalStyle(`${ExtensionList} tr`, {
  lineHeight: '3rem',
  borderBottom: `1px solid ${color.dark}`,
});
globalStyle(`${ExtensionList} th`, {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: '1rem',
  background: color.background,
});
globalStyle(`${ExtensionList} svg`, {fill: color.subdued});
