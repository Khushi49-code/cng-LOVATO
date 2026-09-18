// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clarivo - Warranty & Service Management System",
  description: "Clarivo Tank Testing Plant - Warranty & Service Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        
        {/* ✅ Direct inline script - Button force add */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              setTimeout(() => {
                // Create button
                const btn = document.createElement('button');
                btn.innerHTML = '💬 Help / Support';
                btn.style.position = 'fixed';
                btn.style.bottom = '30px';
                btn.style.right = '30px';
                btn.style.backgroundColor = '#007bff';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.style.borderRadius = '50px';
                btn.style.padding = '14px 28px';
                btn.style.fontSize = '16px';
                btn.style.fontWeight = '600';
                btn.style.zIndex = '9999999';
                btn.style.cursor = 'pointer';
                btn.style.boxShadow = '0 4px 15px rgba(0, 123, 255, 0.5)';
                
                btn.onclick = function() {
                  alert('Support Center - How can we help you?');
                };
                
                document.body.appendChild(btn);
                console.log('✅ Support button added!');
              }, 1000);
            `,
          }}
        />
      </body>
    </html>
  );
}