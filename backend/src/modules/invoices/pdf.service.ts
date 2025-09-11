import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfService {
  async generateInvoicePdf(
    invoice: any,
    options?: {
      color?: string;
      font?: string;
      layout?: string;
      footer?: string;
      pageSize?: string;
      margins?: string;
      watermarkText?: string;
      showSignature?: boolean;
      customFields?: Record<string, string>;
      logoSize?: string;
      companyName?: string;
      companyAddress?: string;
      companyPhone?: string;
      companyEmail?: string;
      headerBorderColor?: string;
      tableHeaderColor?: string;
      accentColor?: string;
    },
  ): Promise<Buffer> {
    try {
      // Import pdf-lib
      let mod: any;
      try {
        mod = await import('pdf-lib/dist/pdf-lib.js');
      } catch {
        try {
          mod = await import('pdf-lib/cjs/index.js');
        } catch {
          mod = await import('pdf-lib');
        }
      }
      const pdfLib = mod.default ?? mod;
      const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib;

      const pdfDoc = await PDFDocument.create();

      // Page size based on invoice.html (A4 with proper margins)
      let pageWidth = 595,
        pageHeight = 842; // A4 default
      const pageSize = (options?.pageSize || '').toLowerCase();
      switch (pageSize) {
        case 'letter':
          pageWidth = 612;
          pageHeight = 792;
          break;
        case 'legal':
          pageWidth = 612;
          pageHeight = 1008;
          break;
        case 'a3':
          pageWidth = 842;
          pageHeight = 1191;
          break;
        case 'a5':
          pageWidth = 420;
          pageHeight = 595;
          break;
        default:
          pageWidth = 595;
          pageHeight = 842; // A4
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const { width, height } = page.getSize();

      // Invoice.html style margins (40px padding = ~30pt)
      let marginTop = 30,
        marginBottom = 30,
        marginLeft = 30,
        marginRight = 30;
      const margins = (options?.margins || '').toLowerCase();
      switch (margins) {
        case 'narrow':
          marginTop = marginBottom = marginLeft = marginRight = 20;
          break;
        case 'wide':
          marginTop = marginBottom = marginLeft = marginRight = 50;
          break;
        case 'moderate':
          marginTop = marginBottom = marginLeft = marginRight = 30;
          break;
        default:
          marginTop = marginBottom = marginLeft = marginRight = 30;
      }

      // Fonts - Arial equivalent (Helvetica) as per invoice.html
      const fontOpt = (options?.font || '').toLowerCase();
      const useTimes = fontOpt.includes('time');
      const useCourier =
        fontOpt.includes('courier') || fontOpt.includes('mono');
      const baseFont = useCourier
        ? await pdfDoc.embedFont(StandardFonts.Courier)
        : useTimes
          ? await pdfDoc.embedFont(StandardFonts.TimesRoman)
          : await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = useCourier
        ? await pdfDoc.embedFont(StandardFonts.CourierBold)
        : useTimes
          ? await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
          : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Colors based on invoice.html CSS (#2c3e50)
      const accentColor = options?.accentColor || '#2c3e50';
      const headerBorderColor = options?.headerBorderColor || accentColor;
      const tableHeaderColor = options?.tableHeaderColor || accentColor;

      // Convert hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16) / 255,
              g: parseInt(result[2], 16) / 255,
              b: parseInt(result[3], 16) / 255,
            }
          : { r: 0.17, g: 0.24, b: 0.31 }; // Default #2c3e50
      };

      const primaryColor = hexToRgb(accentColor);
      const headerBorder = hexToRgb(headerBorderColor);
      const tableHeader = hexToRgb(tableHeaderColor);

      // Currency formatting
      const currencyCode = (invoice.currency || 'USD').toString().toUpperCase();
      let currencySymbol = '$';
      switch (currencyCode) {
        case 'USD':
          currencySymbol = '$';
          break;
        case 'EUR':
          currencySymbol = '€';
          break;
      }

      const formatCurrency = (n: number) =>
        `${currencySymbol}${(Number(n) || 0).toFixed(2)}`;

      // Company information with customization options
      const companyName =
        options?.companyName ||
        invoice.user?.companyName ||
        'Your Company Name';
      const companyAddress =
        options?.companyAddress ||
        invoice.user?.companyAddress ||
        '123 Business Street\nCity, State 12345';
      const companyPhone =
        options?.companyPhone || invoice.user?.companyPhone || '(555) 123-4567';
      const companyEmail =
        options?.companyEmail ||
        invoice.user?.companyEmail ||
        'contact@company.com';

      // Starting position (invoice.html has 40px padding)
      let yPosition = height - marginTop;

      // HEADER SECTION - exactly like invoice.html
      // Company info on left, Invoice details on right

      // Company Name (28px font-size in CSS = ~21pt)
      page.drawText(companyName, {
        x: marginLeft,
        y: yPosition,
        size: 21,
        font: boldFont,
        color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
      });
      yPosition -= 25;

      // Company address lines
      const addressLines = companyAddress.split('\n');
      addressLines.forEach((line) => {
        if (line.trim()) {
          page.drawText(line.trim(), {
            x: marginLeft,
            y: yPosition,
            size: 10,
            font: baseFont,
            color: rgb(0.4, 0.4, 0.4), // #666 in CSS
          });
          yPosition -= 12;
        }
      });

      // Phone
      if (companyPhone) {
        page.drawText(`Phone: ${companyPhone}`, {
          x: marginLeft,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 12;
      }

      // Email
      if (companyEmail) {
        page.drawText(`Email: ${companyEmail}`, {
          x: marginLeft,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Invoice details on right side
      const rightColumnX = width - 200;
      let rightY = height - marginTop;

      // INVOICE title (24px = ~18pt)
      page.drawText('INVOICE', {
        x: rightColumnX,
        y: rightY,
        size: 18,
        font: boldFont,
        color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
      });
      rightY -= 25;

      // Invoice Number
      const invoiceNumber =
        invoice.invoiceNumber || invoice.id || 'INV-2024-001';
      page.drawText(`Invoice #: ${invoiceNumber}`, {
        x: rightColumnX,
        y: rightY,
        size: 10,
        font: boldFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      rightY -= 15;

      // Invoice Date
      const invoiceDate = new Date(
        invoice.invoiceDate || Date.now(),
      ).toLocaleDateString();
      page.drawText(`Date: ${invoiceDate}`, {
        x: rightColumnX,
        y: rightY,
        size: 10,
        font: baseFont,
        color: rgb(0.4, 0.4, 0.4),
      });
      rightY -= 15;

      // Due Date
      const dueDate = new Date(
        invoice.dueDate || Date.now(),
      ).toLocaleDateString();
      page.drawText(`Due Date: ${dueDate}`, {
        x: rightColumnX,
        y: rightY,
        size: 10,
        font: baseFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Header border line (2px solid #2c3e50 in CSS)
      const headerBottomY = Math.min(yPosition, rightY) - 20;
      page.drawRectangle({
        x: marginLeft,
        y: headerBottomY,
        width: width - marginLeft - marginRight,
        height: 2,
        color: rgb(headerBorder.r, headerBorder.g, headerBorder.b),
      });

      yPosition = headerBottomY - 30;

      // BILLING SECTION - Bill To and Ship To side by side
      const billToX = marginLeft;
      const shipToX = width / 2 + 20;

      // Bill To header
      page.drawText('Bill To:', {
        x: billToX,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
      });

      // Ship To header
      page.drawText('Ship To:', {
        x: shipToX,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
      });

      // Underline for headers
      page.drawRectangle({
        x: billToX,
        y: yPosition - 2,
        width: 50,
        height: 1,
        color: rgb(0.87, 0.87, 0.87), // #ddd
      });

      page.drawRectangle({
        x: shipToX,
        y: yPosition - 2,
        width: 55,
        height: 1,
        color: rgb(0.87, 0.87, 0.87),
      });

      yPosition -= 20;

      // Client information
      const client = invoice.client || {};
      const clientName =
        client.name || client.companyName || 'Client Company Name';
      const clientAddress = client.addressLine1 || '456 Client Avenue';
      const clientCity = `${client.city || 'Client City'}, ${client.state || 'State'} ${client.postalCode || '67890'}`;
      const clientPhone = client.phone || '(555) 987-6543';
      const clientEmail = client.email || 'billing@client.com';

      // Bill To content
      page.drawText(clientName, {
        x: billToX,
        y: yPosition,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 12;

      page.drawText(clientAddress, {
        x: billToX,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 12;

      page.drawText(clientCity, {
        x: billToX,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 12;

      if (clientPhone) {
        page.drawText(`Phone: ${clientPhone}`, {
          x: billToX,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 12;
      }

      if (clientEmail) {
        page.drawText(`Email: ${clientEmail}`, {
          x: billToX,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0, 0, 0),
        });
      }

      // Ship To content (same as Bill To for now)
      let shipToY = yPosition + 48; // Reset to same level as Bill To
      page.drawText('Same as Bill To', {
        x: shipToX,
        y: shipToY,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      shipToY -= 12;

      page.drawText(clientAddress, {
        x: shipToX,
        y: shipToY,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      shipToY -= 12;

      page.drawText(clientCity, {
        x: shipToX,
        y: shipToY,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 40;

      // ITEMS TABLE
      const tableStartY = yPosition;
      const tableWidth = width - marginLeft - marginRight;

      // Table header background (#2c3e50)
      page.drawRectangle({
        x: marginLeft,
        y: yPosition - 25,
        width: tableWidth,
        height: 25,
        color: rgb(tableHeader.r, tableHeader.g, tableHeader.b),
      });

      // Table headers
      const descX = marginLeft + 10;
      const qtyX = width - 250;
      const rateX = width - 150;
      const amountX = width - 80;

      page.drawText('Description', {
        x: descX,
        y: yPosition - 18,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1), // white text
      });

      page.drawText('Qty', {
        x: qtyX,
        y: yPosition - 18,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      page.drawText('Rate', {
        x: rateX,
        y: yPosition - 18,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      page.drawText('Amount', {
        x: amountX,
        y: yPosition - 18,
        size: 10,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      yPosition -= 35;

      // Table rows
      const items = invoice.items || [];
      items.forEach((item: any, index: number) => {
        // Alternating row background (#f9f9f9)
        if (index % 2 === 1) {
          page.drawRectangle({
            x: marginLeft,
            y: yPosition - 20,
            width: tableWidth,
            height: 20,
            color: rgb(0.976, 0.976, 0.976), // #f9f9f9
          });
        }

        // Row border
        page.drawRectangle({
          x: marginLeft,
          y: yPosition - 20,
          width: tableWidth,
          height: 1,
          color: rgb(0.87, 0.87, 0.87), // #ddd
        });

        // Item data
        page.drawText(item.description || '', {
          x: descX,
          y: yPosition - 15,
          size: 9,
          font: baseFont,
          color: rgb(0, 0, 0),
          maxWidth: qtyX - descX - 20,
        });

        page.drawText(String(item.quantity || 0), {
          x: qtyX,
          y: yPosition - 15,
          size: 9,
          font: baseFont,
          color: rgb(0, 0, 0),
        });

        page.drawText(formatCurrency(item.rate || 0), {
          x: rateX,
          y: yPosition - 15,
          size: 9,
          font: baseFont,
          color: rgb(0, 0, 0),
        });

        page.drawText(formatCurrency(item.amount || 0), {
          x: amountX,
          y: yPosition - 15,
          size: 9,
          font: baseFont,
          color: rgb(0, 0, 0),
        });

        yPosition -= 25;
      });

      yPosition -= 20;

      // TOTALS SECTION (right-aligned, 300px width like CSS)
      const totalsX = width - 300 - marginRight;
      const totalsWidth = 300;

      const subtotal = Number(invoice.subtotal || 0);
      const discountAmount = Number(invoice.discount || 0);
      const taxRate = Number(invoice.taxRate || 0);
      const taxAmount = Number(
        invoice.taxAmount || ((subtotal - discountAmount) * taxRate) / 100,
      );
      const totalAmount = Number(
        invoice.totalAmount || subtotal - discountAmount + taxAmount,
      );

      // Subtotal
      page.drawText('Subtotal:', {
        x: totalsX,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(formatCurrency(subtotal), {
        x: totalsX + 200,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });

      // Border line
      page.drawRectangle({
        x: totalsX,
        y: yPosition - 2,
        width: totalsWidth,
        height: 1,
        color: rgb(0.87, 0.87, 0.87),
      });

      yPosition -= 20;

      // Tax
      page.drawText(`Tax (${taxRate}%):`, {
        x: totalsX,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(formatCurrency(taxAmount), {
        x: totalsX + 200,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });

      page.drawRectangle({
        x: totalsX,
        y: yPosition - 2,
        width: totalsWidth,
        height: 1,
        color: rgb(0.87, 0.87, 0.87),
      });

      yPosition -= 20;

      // Discount
      if (discountAmount > 0) {
        page.drawText('Discount:', {
          x: totalsX,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0, 0, 0),
        });

        page.drawText(`-${formatCurrency(discountAmount)}`, {
          x: totalsX + 200,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0, 0, 0),
        });

        page.drawRectangle({
          x: totalsX,
          y: yPosition - 2,
          width: totalsWidth,
          height: 1,
          color: rgb(0.87, 0.87, 0.87),
        });

        yPosition -= 20;
      }

      // Total (with background color like CSS)
      page.drawRectangle({
        x: totalsX,
        y: yPosition - 18,
        width: totalsWidth,
        height: 20,
        color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
      });

      page.drawText('Total:', {
        x: totalsX + 10,
        y: yPosition - 12,
        size: 12,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      page.drawText(formatCurrency(totalAmount), {
        x: totalsX + 200,
        y: yPosition - 12,
        size: 12,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      yPosition -= 40;

      // NOTES SECTION (if any)
      const notes = invoice.notes || invoice.terms || options?.footer || '';
      if (notes) {
        // Notes background (#f8f9fa with left border)
        page.drawRectangle({
          x: marginLeft,
          y: yPosition - 60,
          width: width - marginLeft - marginRight,
          height: 60,
          color: rgb(0.973, 0.976, 0.98), // #f8f9fa
        });

        // Left border (4px solid #2c3e50)
        page.drawRectangle({
          x: marginLeft,
          y: yPosition - 60,
          width: 4,
          height: 60,
          color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
        });

        page.drawText('Payment Terms & Notes:', {
          x: marginLeft + 20,
          y: yPosition - 20,
          size: 11,
          font: boldFont,
          color: rgb(primaryColor.r, primaryColor.g, primaryColor.b),
        });

        // Split notes into lines
        const noteLines = notes.split('\n');
        let noteY = yPosition - 35;
        noteLines.forEach((line) => {
          if (line.trim() && noteY > marginBottom + 20) {
            page.drawText(line.trim(), {
              x: marginLeft + 20,
              y: noteY,
              size: 9,
              font: baseFont,
              color: rgb(0, 0, 0),
              maxWidth: width - marginLeft - marginRight - 40,
            });
            noteY -= 12;
          }
        });

        yPosition -= 80;
      }

      // Optional signature block (above footer)
      if (options?.showSignature && yPosition > marginBottom + 80) {
        // Draw signature label and line
        const sigLabel = 'Authorized Signature';
        page.drawText(sigLabel, {
          x: marginLeft,
          y: yPosition - 18,
          size: 10,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawRectangle({
          x: marginLeft,
          y: yPosition - 34,
          width: (width - marginLeft - marginRight) * 0.5,
          height: 1,
          color: rgb(0.7, 0.7, 0.7),
        });
        // Date line on the right
        page.drawText('Date', {
          x: width - marginRight - 150,
          y: yPosition - 18,
          size: 10,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawRectangle({
          x: width - marginRight - 150,
          y: yPosition - 34,
          width: 140,
          height: 1,
          color: rgb(0.7, 0.7, 0.7),
        });
        yPosition -= 50;
      }

      // FOOTER
      const footerText = options?.footer || 'Thank you for your business!';
      if (footerText && yPosition > marginBottom + 40) {
        // Footer border
        page.drawRectangle({
          x: marginLeft,
          y: yPosition - 10,
          width: width - marginLeft - marginRight,
          height: 1,
          color: rgb(0.87, 0.87, 0.87),
        });

        yPosition -= 25;

        page.drawText(footerText, {
          x: width / 2 - baseFont.widthOfTextAtSize(footerText, 10) / 2,
          y: yPosition,
          size: 10,
          font: baseFont,
          color: rgb(0.4, 0.4, 0.4),
        });

        yPosition -= 15;

        const contactText = `If you have any questions about this invoice, please contact us at ${companyPhone}`;
        page.drawText(contactText, {
          x: width / 2 - baseFont.widthOfTextAtSize(contactText, 9) / 2,
          y: yPosition,
          size: 9,
          font: baseFont,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Watermark if specified
      if (options?.watermarkText) {
        const wmText = String(options.watermarkText).toUpperCase();
        const wmSize = 72;
        const wmWidth = boldFont.widthOfTextAtSize(wmText, wmSize);
        const wmX = (width - wmWidth) / 2;
        const wmY = height / 2;
        page.drawText(wmText, {
          x: wmX,
          y: wmY,
          size: wmSize,
          font: boldFont,
          color: rgb(0.75, 0.75, 0.75),
          opacity: 0.18,
          rotate: degrees(45),
        });
      }

      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      console.error('PDF generation failed:', error);
      try {
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
        const pdfDoc2 = await PDFDocument.create();
        const page2 = pdfDoc2.addPage();
        const font2 = await pdfDoc2.embedFont(StandardFonts.Helvetica);
        page2.drawText('Invoice generation failed. Please try again.', {
          x: 50,
          y: 750,
          size: 12,
          font: font2,
          color: rgb(0, 0, 0),
        });
        return Buffer.from(await pdfDoc2.save());
      } catch (fallbackError: any) {
        console.error(
          'PDF generation failed, creating fallback PDF:',
          fallbackError?.message || fallbackError,
        );
        const emptyDoc = new Uint8Array();
        return Buffer.from(emptyDoc);
      }
    }
  }
}
/*
      const title = 'INVOICE';
      const titleSize = 26;
      const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
      // keep at least 20pt gap to logo; fall back to right margin if no logo
      const rightLimit = (bannerLogoW > 0) ? (bannerLogoX - 20) : (width - 40);
      const titleX = Math.max(280, rightLimit - titleWidth);
      page.drawText(title, {
        x: titleX,
        y: bannerBottom + 30,
        size: titleSize,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      page.drawText(invoice.user.companyName || 'Company Name', {
        x: 50,
        y: bannerBottom + 35,
        size: 20,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
    }
    
    if (template !== 'modern' && template !== 'premium') {
      // Classic: company name at top
      page.drawText(invoice.user.companyName || 'Company Name', {
        x: 50,
        y: yPosition,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= isCompact ? 14 : 20;
    }
    // Contact / Address (always on white for modern)
    if (invoice.user.companyAddress) {
      page.drawText(invoice.user.companyAddress, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      yPosition -= isCompact ? 10 : 15;
    }
    
    if (invoice.user.companyPhone) {
      page.drawText(`Phone: ${invoice.user.companyPhone}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      yPosition -= isCompact ? 10 : 15;
    }
    
    if (invoice.user.companyEmail) {
      page.drawText(`Email: ${invoice.user.companyEmail}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      yPosition -= isCompact ? 10 : 15;
    }
    // Separator line below header content
    page.drawRectangle({ x: 50, y: yPosition - 6, width: width - 100, height: 0.5, color: rgb(0.88, 0.88, 0.92) });
    yPosition -= isCompact ? 12 : 18;
    
    // Invoice Title (classic only; modern and premium already drew title in banner)
    yPosition -= isCompact ? 18 : 30;
    if (template !== 'modern' && template !== 'premium') {
      page.drawText('INVOICE', {
        x: width / 2 - 40,
        y: yPosition,
        size: 24,
        font: boldFont,
        color: schemeColor,
      });
    }
    
    // Invoice Details (styled meta box with premium enhancements)
    yPosition -= isCompact ? 24 : 40;
    const metaX = width - 230;
    const metaW = 180;
    const metaH = template === 'premium' ? 90 : 72;
    const metaY = yPosition + (isCompact ? 24 : 34);
    
    if (template === 'premium') {
      // Ultra-premium meta boxes with luxury styling
      const metaItems = [
        { label: 'Invoice #', value: String(invoice.invoiceNumber || invoice.id || '') },
        { label: 'Invoice Date', value: new Date(invoice.invoiceDate).toLocaleDateString() },
        { label: 'Due Date', value: new Date(invoice.dueDate).toLocaleDateString() },
        { label: 'Project Code', value: `PRJ-${String(invoice.id).slice(-4)}` }
      ];
      
      const boxWidth = 160;
      const boxHeight = 70;
      const boxSpacing = 20;
      const startX = 50;
      let currentX = startX;
      
      metaItems.forEach((item, idx) => {
        if (currentX + boxWidth > width - 50) {
          currentX = startX;
          yPosition -= boxHeight + boxSpacing;
        }
        
        // Luxury glass effect box
        page.drawRectangle({
          x: currentX + 3,
          y: yPosition - boxHeight - 3,
          width: boxWidth,
          height: boxHeight,
          color: rgb(0, 0, 0),
          opacity: 0.1
        });
        
        page.drawRectangle({
          x: currentX,
          y: yPosition - boxHeight,
          width: boxWidth,
          height: boxHeight,
          color: rgb(1, 1, 1),
          opacity: 0.95
        });
        
        // Gold accent top border
        page.drawRectangle({
          x: currentX,
          y: yPosition - 4,
          width: boxWidth,
          height: 4,
          color: rgb(1, 0.84, 0)
        });
        
        // Content
        page.drawText(item.label.toUpperCase(), {
          x: currentX + 15,
          y: yPosition - 25,
          size: 9,
          font: boldFont,
          color: rgb(0.4, 0.4, 0.4)
        });
        
        page.drawText(item.value, {
          x: currentX + 15,
          y: yPosition - 45,
          size: 12,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.1)
        });
        
        currentX += boxWidth + boxSpacing;
      });
      
      yPosition -= boxHeight + 30;
    } else {
      // Standard meta box styling
      page.drawRectangle({ 
        x: metaX + 2, 
        y: metaY - metaH - 2, 
        width: metaW, 
        height: metaH, 
        color: shadowColor,
        opacity: 0.2 
      });
      page.drawRectangle({ 
        x: metaX, 
        y: metaY - metaH, 
        width: metaW, 
        height: metaH, 
        color: accentColor 
      });
      // Elegant border
      page.drawRectangle({ 
        x: metaX, 
        y: metaY - metaH, 
        width: metaW, 
        height: metaH, 
        color: schemeColor,
        opacity: 0.15 
      });
      page.drawRectangle({ 
        x: metaX, 
        y: metaY - metaH, 
        width: metaW, 
        height: 1, 
        color: schemeColor,
        opacity: 0.4 
      });
    }
    // Only draw standard meta box content for non-premium templates
    const metaBottom = metaY - metaH;
    if (template !== 'premium') {
      const labelColor = rgb(0.35, 0.35, 0.35);
      let metaLineY = metaY - 16;
      page.drawText('Invoice #', { x: metaX + 10, y: metaLineY, size: 9, font: baseFont, color: labelColor });
      const invNo = String(invoice.invoiceNumber || invoice.id || '');
      const invNoWidth = boldFont.widthOfTextAtSize(invNo, 10);
      page.drawText(invNo, { x: metaX + metaW - 10 - invNoWidth, y: metaLineY, size: 10, font: boldFont, color: rgb(0,0,0) });
      metaLineY -= 16;
      page.drawText('Invoice Date', { x: metaX + 10, y: metaLineY, size: 9, font: baseFont, color: labelColor });
      const invDate = new Date(invoice.invoiceDate).toLocaleDateString();
      const invDateWidth = baseFont.widthOfTextAtSize(invDate, 10);
      page.drawText(invDate, { x: metaX + metaW - 10 - invDateWidth, y: metaLineY, size: 10, font: baseFont, color: rgb(0,0,0) });
      metaLineY -= 16;
      page.drawText('Due Date', { x: metaX + 10, y: metaLineY, size: 9, font: baseFont, color: labelColor });
      const dueDate = new Date(invoice.dueDate).toLocaleDateString();
      const dueDateWidth = baseFont.widthOfTextAtSize(dueDate, 10);
      page.drawText(dueDate, { x: metaX + metaW - 10 - dueDateWidth, y: metaLineY, size: 10, font: baseFont, color: rgb(0,0,0) });
      // Optional status pill (inside meta box, top-right)
      if (invoice.status) {
        const pillText = String(invoice.status).replace(/_/g, ' ');
        const pillPadding = 6;
        const pillTextWidth = boldFont.widthOfTextAtSize(pillText, 8);
        const pillW = pillTextWidth + pillPadding * 2;
        const pillX = metaX + metaW - pillW - 10;
        const pillY = metaY - 20;
        page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: 14, color: schemeColor });
        page.drawText(pillText, { x: pillX + pillPadding, y: pillY + 3, size: 8, font: boldFont, color: rgb(1,1,1) });
      }
    }
    
    // Bill To
    yPosition -= isCompact ? 24 : 40;
    page.drawText('Bill To:', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    const billToHeaderY = yPosition;
    yPosition -= isCompact ? 12 : 20;
    page.drawText(invoice.client.name, {
      x: 50,
      y: yPosition,
      size: 10,
      font: baseFont,
      color: rgb(0, 0, 0),
    });
    
    if (invoice.client.companyName) {
      yPosition -= isCompact ? 10 : 15;
      page.drawText(invoice.client.companyName, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    
    if (invoice.client.addressLine1) {
      yPosition -= isCompact ? 10 : 15;
      page.drawText(invoice.client.addressLine1, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    
    if (invoice.client.city || invoice.client.state || invoice.client.postalCode) {
      yPosition -= isCompact ? 10 : 15;
      const address = `${invoice.client.city || ''} ${invoice.client.state || ''} ${invoice.client.postalCode || ''}`.trim();
      page.drawText(address, {
        x: 50,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    // From block (right column) to balance layout (always start below meta box bottom)
    {
      const fromX = width - 230;
      let fromY = Math.min(billToHeaderY, metaBottom - 12);
      page.drawText('From:', { x: fromX, y: fromY, size: 12, font: boldFont, color: rgb(0,0,0) });
      fromY -= isCompact ? 12 : 20;
      page.drawText(invoice.user.companyName || '', { x: fromX, y: fromY, size: 10, font: boldFont, color: rgb(0,0,0) });
      if (invoice.user.companyAddress) { fromY -= isCompact ? 10 : 15; page.drawText(invoice.user.companyAddress, { x: fromX, y: fromY, size: 9, font: baseFont, color: rgb(0.25,0.25,0.25), maxWidth: 180 }); }
      if (invoice.user.companyPhone) { fromY -= isCompact ? 10 : 15; page.drawText(`Phone: ${invoice.user.companyPhone}`, { x: fromX, y: fromY, size: 9, font: baseFont, color: rgb(0.25,0.25,0.25) }); }
      if (invoice.user.companyEmail) { fromY -= isCompact ? 10 : 15; page.drawText(`Email: ${invoice.user.companyEmail}`, { x: fromX, y: fromY, size: 9, font: baseFont, color: rgb(0.25,0.25,0.25) }); }
      if (invoice.user.taxNumber) { fromY -= isCompact ? 10 : 15; page.drawText(`VAT/Tax: ${invoice.user.taxNumber}`, { x: fromX, y: fromY, size: 9, font: baseFont, color: rgb(0.25,0.25,0.25) }); }
      // Ensure the next section starts below both columns
      yPosition = Math.min(yPosition, fromY) - (isCompact ? 8 : 12);
    }
    
    // Premium Items Table Header with template-specific styling
    yPosition -= isCompact ? 32 : 48;
    const headerHeight = template === 'premium' ? 40 : 32;
    
    if (template === 'premium') {
      // Ultra-premium table header with luxury dark gradient
      const gradientSteps = 6;
      for (let i = 0; i < gradientSteps; i++) {
        const alpha = 1 - (i * 0.1);
        const stepHeight = headerHeight / gradientSteps;
        const stepY = yPosition - 20 + (i * stepHeight);
        const gradientColor = rgb(
          0.06 * alpha + 0.12 * (1 - alpha),
          0.1 * alpha + 0.16 * (1 - alpha),
          0.14 * alpha + 0.24 * (1 - alpha)
        );
        page.drawRectangle({ 
          x: 50, 
          y: stepY, 
          width: width - 100, 
          height: stepHeight + 1, 
          color: gradientColor 
        });
      }
      
      // Gold accent bottom border
      page.drawRectangle({
        x: 50,
        y: yPosition - 20,
        width: width - 100,
        height: 3,
        color: rgb(1, 0.84, 0)
      });
      
      // Luxury shadow
      page.drawRectangle({
        x: 52,
        y: yPosition - 25,
        width: width - 100,
        height: headerHeight,
        color: rgb(0, 0, 0),
        opacity: 0.2
      });
    } else {
      // Header shadow
      page.drawRectangle({
        x: 52,
        y: yPosition - 22,
        width: width - 100,
        height: headerHeight,
        color: shadowColor,
        opacity: 0.15
      });
      
      // Header background with subtle gradient
      if (template === 'modern') {
        // Primary header color
        page.drawRectangle({
          x: 50,
          y: yPosition - 20,
          width: width - 100,
          height: headerHeight,
          color: schemeColor,
        });
        // Gradient overlay
        page.drawRectangle({
          x: 50,
          y: yPosition - 20,
          width: width - 100,
          height: headerHeight / 2,
          color: rgb(1, 1, 1),
          opacity: 0.1
        });
      } else {
        page.drawRectangle({
          x: 50,
          y: yPosition - 20,
          width: width - 100,
          height: headerHeight,
          color: lightGray,
        });
      }
      
      // Premium header border
      page.drawRectangle({
        x: 50,
        y: yPosition - 20 + headerHeight - 1,
        width: width - 100,
        height: 1,
        color: schemeColor,
        opacity: 0.6
      });
    }
    
    // Premium header text with better spacing
    const headerTextColor = (template === 'modern' || template === 'premium') ? rgb(1,1,1) : rgb(0.2, 0.2, 0.2);
    const headerY = yPosition - (template === 'premium' ? 16 : 12);
    
    page.drawText('DESCRIPTION', {
      x: 65,
      y: headerY,
      size: 9,
      font: boldFont,
      color: headerTextColor,
    });
    
    page.drawText('QTY', {
      x: 305,
      y: headerY,
      size: 9,
      font: boldFont,
      color: headerTextColor,
    });
    
    page.drawText('RATE', {
      x: 365,
      y: headerY,
      size: 9,
      font: boldFont,
      color: headerTextColor,
    });
    
    page.drawText('AMOUNT', {
      x: 475,
      y: headerY,
      size: 9,
      font: boldFont,
      color: headerTextColor,
    });
    
    // Items with premium styling
    yPosition -= isCompact ? 30 : 45; // extra gap to avoid overlap with header band
    const qtyX = 310;
    const rateX = 390;
    const amountX = 520;
    const colRightPadding = 20;
    
    invoice.items.forEach((item: any, idx: number) => {
      const rowHeight = isCompact ? 16 : (template === 'premium' ? 28 : 22);
      
      if (template === 'premium') {
        // Ultra-premium row styling with hover-like effects
        if (idx % 2 === 1) {
          // Luxury alternating row background
          page.drawRectangle({ 
            x: 50, 
            y: yPosition - 6, 
            width: width - 100, 
            height: rowHeight, 
            color: rgb(0.98, 0.99, 1.0),
            opacity: 0.8
          });
          
          // Subtle shadow for depth
          page.drawRectangle({ 
            x: 52, 
            y: yPosition - 8, 
            width: width - 100, 
            height: rowHeight, 
            color: rgb(0.9, 0.9, 0.95),
            opacity: 0.3
          });
        }
        
        // Premium description with enhanced typography
        const descLines = (item.description ?? '').split('\n');
        const mainDesc = descLines[0] || '';
        const subDesc = descLines.slice(1).join(' ') || '';
        
        page.drawText(mainDesc, {
          x: 65,
          y: yPosition + 4,
          size: 11,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: qtyX - 90,
        });
        
        if (subDesc) {
          page.drawText(subDesc, {
            x: 65,
            y: yPosition - 8,
            size: 9,
            font: baseFont,
            color: rgb(0.4, 0.4, 0.4),
            maxWidth: qtyX - 90,
          });
        }
      } else {
        // Standard zebra striping for readability
        if (idx % 2 === 1) {
          page.drawRectangle({ x: 50, y: yPosition - 4, width: width - 100, height: rowHeight, color: rowAlt });
        }
        
        // Description (wrap lightly by truncation for now)
        page.drawText(item.description ?? '', {
          x: 60,
          y: yPosition,
          size: 9,
          font: baseFont,
          color: rgb(0, 0, 0),
          maxWidth: qtyX - 80,
        });
      }
      
      // Right-aligned numeric columns with premium styling
      const qtyText = String(item.quantity ?? 0);
      const rateText = `${formatCurrency(item.rate ?? 0)}`;
      const amountText = `${formatCurrency(item.amount ?? 0)}`;
      const fontSize = template === 'premium' ? 10 : 9;
      const fontWeight = template === 'premium' ? boldFont : baseFont;
      const textColor = template === 'premium' ? rgb(0.1, 0.1, 0.1) : rgb(0, 0, 0);
      
      const qtyWidth = fontWeight.widthOfTextAtSize(qtyText, fontSize);
      const rateWidth = fontWeight.widthOfTextAtSize(rateText, fontSize);
      const amountWidth = fontWeight.widthOfTextAtSize(amountText, fontSize);
      
      page.drawText(qtyText, { x: qtyX - colRightPadding - qtyWidth, y: yPosition, size: fontSize, font: fontWeight, color: textColor });
      page.drawText(rateText, { x: rateX - colRightPadding - rateWidth, y: yPosition, size: fontSize, font: fontWeight, color: textColor });
      page.drawText(amountText, { x: amountX - colRightPadding - amountWidth, y: yPosition, size: fontSize, font: fontWeight, color: textColor });
      
      // Row separator with premium styling
      if (template === 'premium') {
        page.drawRectangle({ 
          x: 60, 
          y: yPosition - 10, 
          width: width - 120, 
          height: 0.5, 
          color: rgb(0.85, 0.87, 0.90),
          opacity: 0.6
        });
      } else {
        page.drawRectangle({ x: 50, y: yPosition - 6, width: width - 100, height: 0.5, color: rgb(0.9, 0.9, 0.9) });
      }
      
      yPosition -= isCompact ? 14 : (template === 'premium' ? 24 : 20);
    });
    
    // Totals
    yPosition -= isCompact ? 12 : 20;
    
    // Subtotal
    page.drawText('Subtotal:', {
      x: layoutOpt.includes('left') ? 60 : 400,
      y: yPosition,
      size: 10,
      font: baseFont,
      color: rgb(0, 0, 0),
    });
    
    page.drawText(`${formatCurrency(invoice.subtotal)}`, {
      x: layoutOpt.includes('left') ? 130 : 470,
      y: yPosition,
      size: 10,
      font: baseFont,
      color: rgb(0, 0, 0),
    });
    
    // Tax
    if (invoice.taxAmount > 0) {
      yPosition -= isCompact ? 10 : 15;
      page.drawText(`Tax (${invoice.taxRate}%):`, {
        x: layoutOpt.includes('left') ? 60 : 400,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      
      page.drawText(`${formatCurrency(invoice.taxAmount)}`, {
        x: layoutOpt.includes('left') ? 130 : 470,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    
    // Discount
    if (invoice.discount > 0) {
      yPosition -= isCompact ? 10 : 15;
      const discountText = invoice.discountType === 'PERCENTAGE' 
        ? `Discount (${invoice.discount}%):`
        : 'Discount:';
      
      page.drawText(discountText, {
        x: layoutOpt.includes('left') ? 60 : 400,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      
      const discountAmount = invoice.discountType === 'PERCENTAGE'
        ? (invoice.subtotal * invoice.discount / 100)
        : invoice.discount;
      
      page.drawText(`-${formatCurrency(discountAmount)}`, {
        x: layoutOpt.includes('left') ? 130 : 470,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    // Paid (if any)
    if ((invoice.paidAmount ?? 0) > 0) {
      yPosition -= isCompact ? 10 : 15;
      page.drawText('Paid:', {
        x: layoutOpt.includes('left') ? 60 : 400,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
      page.drawText(`${formatCurrency(invoice.paidAmount)}`, {
        x: layoutOpt.includes('left') ? 130 : 470,
        y: yPosition,
        size: 10,
        font: baseFont,
        color: rgb(0, 0, 0),
      });
    }
    
    // Total (with premium styling for totals box)
    yPosition -= isCompact ? 12 : 20;
    const totalsBoxX = layoutOpt.includes('left') ? 50 : width - 220;
    const totalsBoxY = yPosition + 30;
    const totalsBoxW = layoutOpt.includes('left') ? 280 : (template === 'premium' ? 220 : 180);
    const totalsBoxH = template === 'premium' ? 100 : 80;
    
    if (template === 'premium') {
      // Ultra-premium totals box with luxury styling
      // Shadow
      page.drawRectangle({ 
        x: totalsBoxX + 4, 
        y: totalsBoxY - totalsBoxH - 4, 
        width: totalsBoxW, 
        height: totalsBoxH, 
        color: rgb(0, 0, 0),
        opacity: 0.15
      });
      
      // Main background
      page.drawRectangle({ 
        x: totalsBoxX, 
        y: totalsBoxY - totalsBoxH, 
        width: totalsBoxW, 
        height: totalsBoxH, 
        color: rgb(1, 1, 1),
        opacity: 0.98
      });
      
      // Gold accent border
      page.drawRectangle({ 
        x: totalsBoxX, 
        y: totalsBoxY - 4, 
        width: totalsBoxW, 
        height: 4, 
        color: rgb(1, 0.84, 0)
      });
      
      // Subtle inner border
      page.drawRectangle({ 
        x: totalsBoxX + 2, 
        y: totalsBoxY - totalsBoxH + 2, 
        width: totalsBoxW - 4, 
        height: totalsBoxH - 6, 
        color: rgb(0.95, 0.95, 0.95),
        opacity: 0.5
      });
    } else {
      page.drawRectangle({ x: totalsBoxX, y: totalsBoxY - totalsBoxH, width: totalsBoxW, height: totalsBoxH, color: rgb(0.97, 0.97, 1) });
    }
    // Total line with premium styling
    const totalFontSize = template === 'premium' ? 14 : 11;
    const balanceFontSize = template === 'premium' ? 16 : 12;
    
    page.drawText('Total:', {
      x: totalsBoxX + (template === 'premium' ? 20 : 12),
      y: totalsBoxY - (template === 'premium' ? 30 : 24),
      size: totalFontSize,
      font: boldFont,
      color: template === 'premium' ? rgb(0.1, 0.1, 0.1) : rgb(0, 0, 0),
    });
    const totalText = `${formatCurrency(invoice.totalAmount ?? 0)}`;
    const totalWidth = boldFont.widthOfTextAtSize(totalText, totalFontSize);
    page.drawText(totalText, {
      x: totalsBoxX + totalsBoxW - (template === 'premium' ? 20 : 12) - totalWidth,
      y: totalsBoxY - (template === 'premium' ? 30 : 24),
      size: totalFontSize,
      font: boldFont,
      color: template === 'premium' ? rgb(0.1, 0.1, 0.1) : rgb(0, 0, 0),
    });
    
    // Currency code (secondary display)
    const codeText = currencyCode;
    const codeWidth = baseFont.widthOfTextAtSize(codeText, 8);
    page.drawText(codeText, { 
      x: totalsBoxX + totalsBoxW - (template === 'premium' ? 20 : 12) - codeWidth, 
      y: totalsBoxY - (template === 'premium' ? 45 : 36), 
      size: 8, 
      font: baseFont, 
      color: rgb(0.4,0.4,0.4) 
    });
    
    // Balance Due line with premium styling
    const balanceDue = (invoice.balanceDue ?? ((invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0)));
    const balanceText = `${formatCurrency(balanceDue)}`;
    
    if (template === 'premium') {
      // Premium separator with gold accent
      page.drawRectangle({ 
        x: totalsBoxX + 15, 
        y: totalsBoxY - 60, 
        width: totalsBoxW - 30, 
        height: 1, 
        color: rgb(1, 0.84, 0),
        opacity: 0.6
      });
    } else {
      page.drawRectangle({ x: totalsBoxX + 8, y: totalsBoxY - 54, width: totalsBoxW - 16, height: 0.5, color: rgb(0.88, 0.88, 0.92) });
    }
    
    page.drawText('Balance Due:', {
      x: totalsBoxX + (template === 'premium' ? 20 : 12),
      y: totalsBoxY - (template === 'premium' ? 75 : 64),
      size: balanceFontSize,
      font: boldFont,
      color: template === 'premium' ? rgb(1, 0.84, 0) : schemeColor,
    });
    const balWidth = boldFont.widthOfTextAtSize(balanceText, balanceFontSize);
    page.drawText(balanceText, {
      x: totalsBoxX + totalsBoxW - (template === 'premium' ? 20 : 12) - balWidth,
      y: totalsBoxY - (template === 'premium' ? 75 : 64),
      size: balanceFontSize,
      font: boldFont,
      color: template === 'premium' ? rgb(1, 0.84, 0) : schemeColor,
    });
    
    // Paid ribbon in totals box with premium styling
    if (String(invoice.status || '').toUpperCase() === 'PAID') {
      const ribbonW = template === 'premium' ? 60 : 48;
      const ribbonH = template === 'premium' ? 20 : 16;
      const ribbonX = totalsBoxX + totalsBoxW - ribbonW - (template === 'premium' ? 20 : 12);
      const ribbonY = totalsBoxY - (template === 'premium' ? 20 : 16);
      
      if (template === 'premium') {
        // Premium PAID ribbon with gold styling
        page.drawRectangle({ 
          x: ribbonX, 
          y: ribbonY, 
          width: ribbonW, 
          height: ribbonH, 
          color: rgb(1, 0.84, 0)
        });
        page.drawText('PAID', { 
          x: ribbonX + 12, 
          y: ribbonY + 5, 
          size: 11, 
          font: boldFont, 
          color: rgb(0.1, 0.1, 0.1)
        });
      } else {
        page.drawRectangle({ x: ribbonX, y: ribbonY, width: ribbonW, height: ribbonH, color: schemeColor });
        page.drawText('PAID', { x: ribbonX + 8, y: ribbonY + 3, size: 9, font: boldFont, color: rgb(1,1,1) });
      }
    }
    // Ensure following sections are below the totals box
    yPosition = totalsBoxY - totalsBoxH - (isCompact ? 16 : 24);

    // Optional QR code linking to public invoice/pay URL
    try {
      let QR: any = null;
      try {
        // Avoid static analyzer resolution; require at runtime if available
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const req: any = eval('require');
        const moduleName = 'qrcode';
        QR = req(moduleName);
      } catch {}
      if (QR && typeof QR.toDataURL === 'function') {
        const baseUrl = process.env.FRONTEND_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3000';
        const path = (invoice.shareId ? `/public/invoices/${invoice.shareId}` : `/invoices/${invoice.id}`);
        const url = `${baseUrl}${path}`;
        const dataUrl: string = await QR.toDataURL(url, { margin: 0, width: 120 });
        const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
        if (m) {
          const bytes = new Uint8Array(Buffer.from(m[1], 'base64'));
          const img = await pdfDoc.embedPng(bytes);
          const imgW = 90; const scale = imgW / img.width; const imgH = img.height * scale;
          const qrX = 50; const qrY = Math.max(90, yPosition - imgH - 10);
          page.drawImage(img, { x: qrX, y: qrY, width: imgW, height: imgH });
          page.drawText('Scan to view/pay', { x: qrX, y: qrY - 12, size: 8, font: baseFont, color: rgb(0.4,0.4,0.4) });
        }
      }
    } catch { /* optional */
