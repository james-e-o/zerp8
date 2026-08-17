'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, List, Workflow, Package, AlertCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

export default function OrdersLayout({ children }) {
	const params = useParams();
	const { u, companySlug, branch } = params;
	const [sidebarOpen, setSidebarOpen] = useState(true);

	const navigationItems = [
		{ label: 'Orders', href: '/', icon: List },
		{ label: 'Create Order', href: 'create', icon: Plus },
		{ label: 'Workflow & Status', href: 'workflow', icon: Workflow },
		{ label: 'Fulfillment', href: 'fulfillment', icon: Package },
		{ label: 'Backorders', href: 'backorders', icon: AlertCircle },
		{ label: 'Reports', href: 'reports', icon: BarChart3 },
	];

	return (
		<div className="w-full flex-col font-WixMade flex px-1 h-full overflow-hidden">
			{/* Sidebar Navigation */}
			<header
				className={` bg-white border-gray-200 transition-all py-1 items-center duration-300 flex `}
			>
				<div className="text-base ml-2 mr-5">
					<h2 className=" font-bold  text-gray-800">Orders</h2>
				</div>
				<nav className="flex gap-1.5 overflow-y-auto">
					{navigationItems.map((item) => (
						<Link
							key={item.label}
							href={`/users/${u}/company/${companySlug}/branches/${branch}/modules/orders/${item.href}`}
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
				<div className="p-2 ">
					{children}
				</div>
			</main>
		</div>
	);
}
