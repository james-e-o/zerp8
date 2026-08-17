'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ProductsMenuToggle() {
	const [menuView, setMenuView] = useState('expanded');

	const handleToggle = () => {
		const newView = menuView === 'expanded' ? 'collapsed' : 'expanded';
		setMenuView(newView);
		
		// Update nav element's data attribute
		const nav = document.getElementById('products-nav');
		if (nav) {
			nav.setAttribute('data-menu-view', newView);
		}
		
		// Save to localStorage
		localStorage.setItem('products-menu-view', newView);
	};

	return (
		<Button
			onClick={handleToggle}
			variant="icon"
		>
			{menuView === 'expanded' ? '◀' : '▶'}
		</Button>
	);
}
