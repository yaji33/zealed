import { ImageResponse } from "next/og";

export const alt = "Zealed — Save. Win privately.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#f5f3ee",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            color: "#b8f5e6",
            fontWeight: 500,
          }}
        >
          ZEALED
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
            }}
          >
            Save. Win privately.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 26,
              color: "rgba(245,243,238,0.72)",
              maxWidth: 820,
            }}
          >
            Confidential prize savings on Zama fhEVM. Principal stays yours.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
