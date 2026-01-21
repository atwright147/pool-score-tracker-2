import { Button, Group, Modal, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface FriendAddModalProps {
	opened: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message?: ReactNode;
	isLoading?: boolean;
}

export function FriendAddModal({
	opened,
	onClose,
	onConfirm,
	title = 'Confirm Action',
	message = 'Are you sure you want to proceed?',
	isLoading = false,
}: FriendAddModalProps) {
	const handleConfirm = () => {
		onConfirm();
		onClose();
	};

	return (
		<Modal opened={opened} onClose={onClose} title={title} centered>
			<Text mb="md">{message}</Text>
			<Group justify="flex-end" mt="md">
				<Button variant="default" onClick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleConfirm} loading={isLoading}>
					Confirm
				</Button>
			</Group>
		</Modal>
	);
}
