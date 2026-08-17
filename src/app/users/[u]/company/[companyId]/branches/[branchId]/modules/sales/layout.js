'use client';

export default function SalesLayout({ children }) {
	return (
		<div className="w-full flex-col font-WixMade flex px-1 h-full overflow-hidden">
			{/* Main Content */}
			<main className="flex-1 overflow-auto">
				<div className="p-2 ">
					{children}
				</div>
			</main>
		</div>
	);
}

