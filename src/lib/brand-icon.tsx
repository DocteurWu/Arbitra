import { ImageResponse } from "next/og";

/**
 * Icône de l'app : balance ambre sur fond sombre, dessinée à la volée (aucun fichier image à maintenir).
 * La balance occupe ~56 % du carré : elle reste entière même quand Android/iOS arrondissent ou
 * recadrent l'icône (« maskable », zone de sécurité de 80 %).
 */
export function brandIcon(size: number): ImageResponse {
  const glyph = Math.round(size * 0.56);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1c1917 0%, #09090b 100%)",
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
