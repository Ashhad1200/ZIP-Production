import { Request, Response, NextFunction } from 'express';
import { bankAccountService } from '../../services/platform/bank-account.service';

export class BankAccountController {
  /** Public — bank details shown on the "Payment Required" screen. */
  async listActive(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bankAccountService.listActive() });
    } catch (error) {
      next(error);
    }
  }

  async listAll(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ data: await bankAccountService.listAll() });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { bankName, accountTitle, accountNumber, iban, branchCode, sortOrder } = req.body;
      if (!bankName || !accountTitle || !accountNumber) {
        res.status(422).json({
          error: { code: 'VALIDATION_ERROR', message: 'bankName, accountTitle and accountNumber are required' },
        });
        return;
      }
      const account = await bankAccountService.create({ bankName, accountTitle, accountNumber, iban, branchCode, sortOrder });
      res.status(201).json({ data: account });
    } catch (error) {
      next(error);
    }
  }

  async setActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.body;
      const account = await bankAccountService.setActive(req.params.id as string, Boolean(isActive));
      res.json({ data: account });
    } catch (error) {
      next(error);
    }
  }
}

export const bankAccountController = new BankAccountController();
