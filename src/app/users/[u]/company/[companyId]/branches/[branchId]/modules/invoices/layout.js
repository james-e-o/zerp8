'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Settings2 ,Palette,LayoutTemplate,FilePlus,FileStack} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

export default function InvoicesLayout({ children}) {
    const params = useParams();
    const {u, companySlug, branch} = params;
	const [sidebarOpen, setSidebarOpen] = useState(true);

	const navigationItems = [
		{ label: 'Overview', href: '/', icon: FileStack },
		{ label: 'Create Invoice', href: 'create', icon: FilePlus },
		{ label: 'Templates', href: 'templates', icon: LayoutTemplate },
		{ label: 'Settings', href: 'settings', icon: Settings2 },
	];

	return (
		<div className="w-full flex-col font-WixMade flex px-1 h-full overflow-hidden">
			{/* Sidebar Navigation */}
			<header
				className={` bg-white border-gray-200 transition-all py-1 items-center duration-300 flex `}
			>
				<div className="text-base ml-2 mr-5">
					<h2 className=" font-bold  text-gray-800">Invoices</h2>
				</div>
				<nav className="flex gap-1.5 overflow-y-auto">
					{navigationItems.map((item) => (
						<Link
							key={item.label}
							href={`/admin/${u}/company/${companySlug}/branches/${branch}/modules/invoices/${item.href}`}
						>
                            <Button variant={'ghost'} className={'h-7'}>
                                <span className="text-xl"><item.icon className='text-army font-extrabold'/></span>
                                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                            </Button>
						</Link>
					))}
				</nav>
				<div className="">
					<Button
						onClick={() => setSidebarOpen(!sidebarOpen)}
						variant="icon"
					>
						{sidebarOpen ? '◀' : '▶'}
					</Button>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1 overflow-auto">
				<div className="p-8">
					{children}
				</div>
			</main>
		</div>
	);
}