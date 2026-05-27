/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Order {
  orderDate: Date;
  pharmacyId: string;
  pharmacyName: string;
  productId: string;
  productName: string;
  revenue: number;
}

export interface Product {
  productId: string;
  productName: string;
}

export interface Contract {
  registrationDate: Date;
  pharmacyId: string;
  pharmacyName: string;
  committedRevenue: number;
}

export interface ReconciliationResult {
  pharmacyId: string;
  pharmacyName: string;
  registrationDate: Date;
  committedRevenue: number;
  actualRevenue: number;
  isAchieved: boolean;
  validOrders: Order[];
}
