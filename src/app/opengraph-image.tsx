import { ImageResponse } from 'next/og';

export const alt = 'Lelungo travel deal discovery preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#08111f',
          color: '#f8fafc',
          padding: 72,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            color: '#f7c948',
            fontSize: 34,
            fontWeight: 700,
            marginBottom: 38,
          }}
        >
          Lelungo
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 900,
            fontSize: 74,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          Discover hidden travel deals before everyone else.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 34,
            maxWidth: 720,
            color: '#cbd5e1',
            fontSize: 30,
            lineHeight: 1.35,
          }}
        >
          AI-powered insights for smarter flights, hotels, and trip decisions.
        </div>
      </div>
    ),
    size,
  );
}
