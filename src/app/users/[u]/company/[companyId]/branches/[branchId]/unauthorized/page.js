'use client';

import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TriangleAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const module = searchParams.get('module');
	const { u, companyId, branchId } = params;

	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-100">
			<div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center border border-army/10">
				<div className="flex justify-center mb-4">
					<div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
						<TriangleAlert className="text-red-600" size={32} strokeWidth={2} />
					</div>
				</div>
				<h1 className="text-2xl font-bold text-core mb-2">Access Denied</h1>
				<p className="text-gray-600 mb-6">
					{module
						? `Your subscription plan doesn't include access to the ${module} module.`
						: 'You do not have permission to access this resource.'}
				</p>
				<p className="text-sm text-gray-500 mb-6">
					Please upgrade your subscription plan to unlock this feature.
				</p>
				<Link href={`/users/${u}/company/${companyId}/branches/${branchId}`}>
					<Button className="w-full bg-army hover:bg-army/90 text-white font-semibold">
						<ArrowLeft size={16} className="mr-2" />
						Go Back
					</Button>
				</Link>
			</div>
		</div>
	);
}
