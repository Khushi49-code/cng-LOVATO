"use client";

export default function SupportButton() {
  const handleClick = () => {
    alert("Support Center - How can we help you?");
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "50px",
        padding: "14px 28px",
        fontSize: "16px",
        fontWeight: 600,
        zIndex: 9999999,
        cursor: "pointer",
        boxShadow: "0 4px 15px rgba(0, 123, 255, 0.5)",
      }}
    >
      💬 Help / Support
    </button>
  );
}