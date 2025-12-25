import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const playfairDisplay = Playfair_Display({
	variable: "--font-playfair-display",
	subsets: ["latin"],
});

const plusJakarta = localFont({
	src: [
		{
			path: "../assets/fonts/PlusJakartaSans-Variable.woff2",
			style: "normal",
		},
		{
			path: "../assets/fonts/PlusJakartaSans-VariableItalic.woff2",
			style: "italic",
		},
	],
	variable: "--font-jakarta",
});

export const metadata: Metadata = {
	title: "Enoch Zhu",
	description: "Enoch Zhu's personal website.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${playfairDisplay.variable} ${plusJakarta.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
