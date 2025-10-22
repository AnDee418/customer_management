import type { Metadata } from "next";
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { SupabaseProvider } from '@/lib/supabase/client-provider'
import { AuthProvider } from '@/lib/auth/auth-context'
import "./globals.css";

// FontAwesomeのCSS自動挿入を無効化（Next.jsで手動管理）
config.autoAddCss = false

export const metadata: Metadata = {
  title: "社内顧客管理システム",
  description: "セキュリティ最優先の顧客管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <SupabaseProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}

