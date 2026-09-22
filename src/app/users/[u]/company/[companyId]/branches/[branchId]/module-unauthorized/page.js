import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TriangleAlert, ArrowLeft } from 'lucide-react';

export default async function UnauthorizedPage({ params, searchParams }) {
	const { u, companyId, branchId } = await params;
	const { module } = await searchParams;
	const branchDashboardHref = `/users/${u}/company/${companyId}/branches/${branchId}`;

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-100">
			<div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center border border-army/10">
				<div className="flex justify-center mb-4">
					<div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
						<TriangleAlert className="text-red-600" size={32} strokeWidth={2} />
					</div>
				</div>
				<h1 className="text-2xl font-bold text-core mb-2">Module Access Denied</h1>
				<p className="text-gray-600 mb-6">
					{module
						? `Your subscription plan doesn't include access to the ${module} module.`
						: 'You do not have permission to access this module.'}
				</p>
				<p className="text-sm text-gray-500 mb-6">
					Please upgrade your subscription plan to unlock this feature.
				</p>
				<Link href={branchDashboardHref}>
					<Button className="w-full bg-core hover:bg-core/90 text-white font-semibold">
						<ArrowLeft size={16} className="mr-2" />
						Go Back
					</Button>
				</Link>
			</div>
		</div>
	);
}