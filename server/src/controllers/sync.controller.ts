import type { Request, Response } from 'express';

import { verifyTransactionsForOwner, type VerifyTransactionInput } from '../models/sync.model';

type VerifyTransactionsBody = {
  transactions?: unknown;
};

function isValidTransactionInput(value: unknown): value is VerifyTransactionInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const transaction = value as Partial<VerifyTransactionInput>;
  return (
    typeof transaction.clientMutationId === 'string' &&
    typeof transaction.rawText === 'string' &&
    (transaction.source === 'voice' || transaction.source === 'typed' || transaction.source === 'manual') &&
    typeof transaction.parserSource === 'string' &&
    typeof transaction.isUtang === 'boolean' &&
    Array.isArray(transaction.items)
  );
}

export async function verifyTransactions(
  req: Request<unknown, unknown, VerifyTransactionsBody>,
  res: Response,
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized.',
    });
  }

  const inputTransactions = req.body?.transactions;
  if (!Array.isArray(inputTransactions) || inputTransactions.length === 0) {
    return res.status(400).json({
      message: 'transactions must be a non-empty array.',
    });
  }

  if (inputTransactions.length > 25) {
    return res.status(400).json({
      message: 'transactions batch limit is 25.',
    });
  }

  if (!inputTransactions.every(isValidTransactionInput)) {
    return res.status(400).json({
      message: 'Invalid transaction payload.',
    });
  }

  const result = await verifyTransactionsForOwner(user.id, inputTransactions);

  return res.status(200).json({
    storeId: result.storeId,
    results: result.results,
  });
}
