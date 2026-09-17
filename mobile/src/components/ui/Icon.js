import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

// A small set of monoline icons (in the style of Lucide) used in place of
// emoji throughout the app, so icon color/size can follow the surrounding
// theme instead of being locked to whatever an emoji glyph renders as.
const PATHS = {
  wrench: (
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  user: (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  battery: (
    <>
      <Rect width="17" height="11" x="2" y="6" rx="2" ry="2" />
      <Line x1="22" x2="22" y1="10" y2="13" />
    </>
  ),
  camera: (
    <>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx="12" cy="13" r="3" />
    </>
  ),
  package: (
    <>
      <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <Path d="m3.3 7 8.7 5 8.7-5" />
      <Path d="M12 22V12" />
    </>
  ),
  truck: (
    <>
      <Path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <Path d="M15 18H9" />
      <Path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <Circle cx="17" cy="18" r="2" />
      <Circle cx="7" cy="18" r="2" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  lock: (
    <>
      <Rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  checkCircle: (
    <>
      <Path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <Path d="m9 11 3 3L22 4" />
    </>
  ),
  close: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
  alertTriangle: (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </>
  ),
  photo: (
    <>
      <Rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <Circle cx="9" cy="9" r="2" />
      <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.35-4.35" />
    </>
  ),
  calendar: (
    <>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width="18" height="18" x="3" y="4" rx="2" />
      <Path d="M3 10h18" />
    </>
  ),
  award: (
    <>
      <Circle cx="12" cy="8" r="6" />
      <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ),
  arrowRight: <Path d="M5 12h14m-6-6 6 6-6 6" />,
  arrowLeft: <Path d="M19 12H5m6-6-6 6 6 6" />,
  x: (
    <>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </>
  ),
  zoomIn: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
      <Line x1="11" y1="8" x2="11" y2="14" />
      <Line x1="8" y1="11" x2="14" y2="11" />
    </>
  ),
  eye: (
    <>
      <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  zap: <Path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />,
  flask: (
    <>
      <Path d="M9 2v6.29a2 2 0 0 1-.5 1.32L4.21 15A2 2 0 0 0 6 18h12a2 2 0 0 0 1.79-3l-4.3-5.4a2 2 0 0 1-.49-1.3V2" />
      <Path d="M6.5 9h11" />
      <Path d="M8 2h8" />
    </>
  ),
  card: (
    <>
      <Rect width="20" height="14" x="2" y="5" rx="2" />
      <Line x1="2" x2="22" y1="10" y2="10" />
    </>
  ),
  grid: (
    <>
      <Rect width="7" height="9" x="3" y="3" rx="1" />
      <Rect width="7" height="5" x="14" y="3" rx="1" />
      <Rect width="7" height="9" x="14" y="12" rx="1" />
      <Rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
};

export default function Icon({ name, color = '#0f172a', size = 20, strokeWidth = 2 }) {
  const content = PATHS[name];
  if (!content) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {content}
    </Svg>
  );
}
