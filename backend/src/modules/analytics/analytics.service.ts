import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus, PaymentStatus } from '../../common/enums';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(userId: string) {
    const currentDate = new Date();
    const currentMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const lastMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
    const currentYear = new Date(currentDate.getFullYear(), 0, 1);

    const [
      totalInvoices,
      totalClients,
      totalRevenue,
      pendingAmount,
      monthlyRevenue,
      overdueInvoices,
      overdueAmountAgg,
      recentInvoices,
      topClients,
    ] = await Promise.all([
      // Total invoices count
      this.prisma.invoice.count({ where: { userId } }),

      // Total clients count
      this.prisma.client.count({ where: { userId, isActive: true } }),

      // Total revenue (paid invoices)
      this.prisma.invoice.aggregate({
        where: { userId, status: InvoiceStatus.PAID },
        _sum: { totalAmount: true },
      }),

      // Pending amount (includes SENT, VIEWED, and OVERDUE)
      this.prisma.invoice.aggregate({
        where: {
          userId,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.VIEWED,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        _sum: { totalAmount: true },
      }),

      // Monthly revenue
      this.prisma.invoice.aggregate({
        where: {
          userId,
          status: InvoiceStatus.PAID,
          paidAt: { gte: currentMonth },
        },
        _sum: { totalAmount: true },
      }),

      // Overdue invoices count (explicit OVERDUE status)
      this.prisma.invoice.count({
        where: {
          userId,
          status: InvoiceStatus.OVERDUE,
        },
      }),

      // Overdue amount (sum of OVERDUE invoices)
      this.prisma.invoice.aggregate({
        where: {
          userId,
          status: InvoiceStatus.OVERDUE,
        },
        _sum: { totalAmount: true },
      }),

      // Recent invoices
      this.prisma.invoice.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),

      // Top clients by revenue
      this.prisma.client.findMany({
        where: { userId },
        take: 5,
        include: {
          invoices: {
            where: { status: InvoiceStatus.PAID },
            select: { totalAmount: true },
          },
        },
      }),
    ]);

    // Calculate top clients with total revenue
    const topClientsWithRevenue = topClients
      .map((client) => ({
        id: client.id,
        name: client.name,
        email: client.email,
        totalRevenue: client.invoices.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        ),
        invoiceCount: client.invoices.length,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return {
      totalInvoices,
      totalClients,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      pendingAmount: pendingAmount._sum.totalAmount || 0,
      monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
      overdueInvoices,
      overdueAmount: overdueAmountAgg._sum.totalAmount || 0,
      recentInvoices,
      topClients: topClientsWithRevenue,
    };
  }

  async getRevenueAnalytics(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month',
  ) {
    const currentDate = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'week':
        startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );
        groupBy = 'day';
        break;
      case 'year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        groupBy = 'month';
        break;
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        totalAmount: true,
        status: true,
        paidAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group data by period
    const revenueData = this.groupRevenueByPeriod(invoices, groupBy);

    // Calculate growth rate
    const currentPeriodRevenue = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const previousPeriodInvoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        status: InvoiceStatus.PAID,
        paidAt: {
          gte: new Date(
            startDate.getTime() - (currentDate.getTime() - startDate.getTime()),
          ),
          lt: startDate,
        },
      },
      select: { totalAmount: true },
    });

    const previousPeriodRevenue = previousPeriodInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );

    const growthRate =
      previousPeriodRevenue > 0
        ? ((currentPeriodRevenue - previousPeriodRevenue) /
            previousPeriodRevenue) *
          100
        : 0;

    return {
      period,
      revenueData,
      totalRevenue: currentPeriodRevenue,
      growthRate: growthRate.toFixed(2),
      invoiceCount: invoices.length,
      paidInvoices: invoices.filter((inv) => inv.status === InvoiceStatus.PAID)
        .length,
    };
  }

  async getInvoiceAnalytics(userId: string) {
    const [statusDistribution, monthlyInvoices, averagePaymentTime] =
      await Promise.all([
        // Invoice status distribution
        this.prisma.invoice.groupBy({
          by: ['status'],
          where: { userId },
          _count: { status: true },
        }),

        // Monthly invoice creation trend
        this.getMonthlyInvoiceTrend(userId),

        // Average payment time
        this.getAveragePaymentTime(userId),
      ]);

    return {
      statusDistribution: statusDistribution.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      monthlyInvoices,
      averagePaymentTime,
    };
  }

  async getClientAnalytics(userId: string) {
    const [
      clientTypeDistribution,
      clientGrowth,
      mostActiveClients,
      clientRetention,
    ] = await Promise.all([
      // Client type distribution
      this.prisma.client.groupBy({
        by: ['clientType'],
        where: { userId },
        _count: { clientType: true },
      }),

      // Monthly client growth
      this.getMonthlyClientGrowth(userId),

      // Most active clients
      this.prisma.client.findMany({
        where: { userId },
        include: {
          _count: { select: { invoices: true } },
          invoices: {
            where: { status: InvoiceStatus.PAID },
            select: { totalAmount: true },
          },
        },
        take: 10,
      }),

      // Client retention rate
      this.calculateClientRetention(userId),
    ]);

    const sortedActiveClients = mostActiveClients
      .map((client) => ({
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        invoiceCount: client._count.invoices,
        totalRevenue: client.invoices.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        ),
      }))
      .sort((a, b) => b.invoiceCount - a.invoiceCount);

    return {
      clientTypeDistribution: clientTypeDistribution.map((item) => ({
        type: item.clientType,
        count: item._count.clientType,
      })),
      clientGrowth,
      mostActiveClients: sortedActiveClients,
      clientRetention,
    };
  }

  async getPaymentAnalytics(userId: string) {
    const [
      paymentMethodDistribution,
      monthlyPayments,
      paymentStatusDistribution,
      averagePaymentAmount,
    ] = await Promise.all([
      // Payment method distribution
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          invoice: { userId },
          status: PaymentStatus.COMPLETED,
        },
        _count: { paymentMethod: true },
        _sum: { amount: true },
      }),

      // Monthly payment trend
      this.getMonthlyPaymentTrend(userId),

      // Payment status distribution
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { invoice: { userId } },
        _count: { status: true },
      }),

      // Average payment amount
      this.prisma.payment.aggregate({
        where: {
          invoice: { userId },
          status: PaymentStatus.COMPLETED,
        },
        _avg: { amount: true },
      }),
    ]);

    return {
      paymentMethodDistribution: paymentMethodDistribution.map((item) => ({
        method: item.paymentMethod,
        count: item._count.paymentMethod,
        totalAmount: item._sum.amount || 0,
      })),
      monthlyPayments,
      paymentStatusDistribution: paymentStatusDistribution.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      averagePaymentAmount: averagePaymentAmount._avg.amount || 0,
    };
  }

  // Helper methods
  private groupRevenueByPeriod(invoices: any[], groupBy: string) {
    const grouped = {};

    invoices.forEach((invoice) => {
      let key: string;
      const date = new Date(invoice.createdAt);

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          total: 0,
          paid: 0,
          pending: 0,
          count: 0,
        };
      }

      grouped[key].total += invoice.totalAmount;
      grouped[key].count += 1;

      if (invoice.status === InvoiceStatus.PAID) {
        grouped[key].paid += invoice.totalAmount;
      } else if (
        [
          InvoiceStatus.SENT,
          InvoiceStatus.VIEWED,
          InvoiceStatus.OVERDUE,
        ].includes(invoice.status)
      ) {
        grouped[key].pending += invoice.totalAmount;
      }
    });

    return Object.values(grouped);
  }

  private async getMonthlyInvoiceTrend(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
      },
    });

    const grouped = {};
    invoices.forEach((invoice) => {
      const date = new Date(invoice.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([month, count]) => ({
      month,
      count,
    }));
  }

  private async getAveragePaymentTime(userId: string) {
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        userId,
        status: InvoiceStatus.PAID,
        paidAt: { not: null },
      },
      select: {
        invoiceDate: true,
        paidAt: true,
      },
    });

    if (paidInvoices.length === 0) return 0;

    const totalDays = paidInvoices.reduce((sum, invoice) => {
      const days = Math.floor(
        (invoice.paidAt!.getTime() - invoice.invoiceDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return sum + days;
    }, 0);

    return Math.round(totalDays / paidInvoices.length);
  }

  private async getMonthlyClientGrowth(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const clients = await this.prisma.client.findMany({
      where: {
        userId,
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        createdAt: true,
      },
    });

    const grouped = {};
    clients.forEach((client) => {
      const date = new Date(client.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([month, count]) => ({
      month,
      count,
    }));
  }

  private async calculateClientRetention(userId: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const activeClients = await this.prisma.client.count({
      where: {
        userId,
        invoices: {
          some: {
            createdAt: { gte: threeMonthsAgo },
          },
        },
      },
    });

    const totalClients = await this.prisma.client.count({
      where: { userId },
    });

    return totalClients > 0 ? (activeClients / totalClients) * 100 : 0;
  }

  private async getMonthlyPaymentTrend(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { userId },
        status: PaymentStatus.COMPLETED,
        paymentDate: { gte: sixMonthsAgo },
      },
      select: {
        paymentDate: true,
        amount: true,
      },
    });

    const grouped = {};
    payments.forEach((payment) => {
      const date = new Date(payment.paymentDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = { month: key, amount: 0, count: 0 };
      }
      grouped[key].amount += payment.amount;
      grouped[key].count += 1;
    });

    return Object.values(grouped);
  }
}
