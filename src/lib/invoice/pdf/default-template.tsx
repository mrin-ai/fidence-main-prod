import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { amountToWords } from "@/lib/invoice/amount-to-words";
import { calculateInvoiceTotal, calculateSubtotal } from "@/lib/invoice/calculate-totals";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoicePdfPayment } from "@/lib/invoice/invoice-payment-link";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import { invoiceReference } from "@/lib/invoice/schema";

import {
  invoicePdfFontFamily,
  invoicePdfMonoFontFamily,
} from "./register-fonts";

function formatInvoiceDate(value?: Date | null) {
  if (!value) return "—";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

function createStyles(
  fontFamily: string,
  monoFamily: string,
  accentColor: string,
  darkMode: boolean,
) {
  const foreground = darkMode ? "#FFFFFF" : "#111827";
  const muted = darkMode ? "#A3A3A3" : "#6B7280";
  const subtle = darkMode ? "#737373" : "#9CA3AF";
  const border = darkMode ? "#262626" : "#E5E7EB";
  const borderStrong = darkMode ? "#404040" : "#D1D5DB";
  const cardBg = darkMode ? "#262626" : "#F3F4F6";
  const pageBg = darkMode ? "#181818" : "#FFFFFF";
  const heading = darkMode ? "#FFFFFF" : accentColor;
  const tableHeaderBg = darkMode ? "#404040" : accentColor;

  return StyleSheet.create({
    page: {
      padding: 36,
      fontSize: 10,
      fontFamily,
      color: foreground,
      backgroundColor: pageBg,
      flexDirection: "column",
    },
    content: {
      flexGrow: 1,
    },
    title: {
      fontFamily: monoFamily,
      fontSize: 28,
      fontWeight: 700,
      color: heading,
      marginBottom: 18,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 28,
    },
    metaBlock: {
      width: 210,
    },
    logo: {
      width: 80,
      height: 80,
      objectFit: "contain",
    },
    signatureBlock: {
      alignItems: "flex-end",
      marginBottom: 12,
      width: "100%",
    },
    signatureLabel: {
      fontSize: 8,
      color: muted,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    metaLabel: {
      color: muted,
      fontSize: 10,
    },
    metaValue: {
      fontFamily: monoFamily,
      fontSize: 10,
      color: foreground,
    },
    billingRow: {
      flexDirection: "row",
      marginBottom: 24,
    },
    billingCard: {
      flex: 1,
      backgroundColor: cardBg,
      borderRadius: 10,
      padding: 14,
    },
    billingCardLeft: {
      marginRight: 10,
    },
    billingCardTitle: {
      color: heading,
      fontSize: 11,
      fontWeight: 700,
      marginBottom: 8,
    },
    billingName: {
      fontSize: 10,
      fontWeight: 700,
      marginBottom: 4,
      color: foreground,
    },
    billingAddress: {
      fontSize: 9,
      color: muted,
      lineHeight: 1.45,
    },
    table: {
      borderRadius: 10,
      overflow: "hidden",
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: tableHeaderBg,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    tableHeaderText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: 700,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    tableRowLast: {
      borderBottomWidth: 0,
    },
    colItem: { width: "44%" },
    colQty: { width: "14%", textAlign: "right" },
    colPrice: { width: "20%", textAlign: "right" },
    colTotal: { width: "22%", textAlign: "right" },
    itemName: {
      fontSize: 10,
      fontWeight: 700,
      marginBottom: 2,
      color: foreground,
    },
    itemDescription: {
      fontSize: 9,
      color: muted,
    },
    totalsBlock: {
      width: 220,
      alignSelf: "flex-end",
    },
    bottomSection: {
      marginTop: "auto",
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: border,
      width: "100%",
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    totalLabel: {
      color: muted,
      fontSize: 10,
    },
    totalValue: {
      fontFamily: monoFamily,
      fontSize: 10,
      color: foreground,
    },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: borderStrong,
      paddingTop: 10,
      marginTop: 2,
      marginBottom: 10,
    },
    grandTotalLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: foreground,
    },
    grandTotalValue: {
      fontFamily: monoFamily,
      fontSize: 22,
      fontWeight: 700,
      color: foreground,
    },
    totalInWordsLabel: {
      fontSize: 8,
      color: subtle,
      marginBottom: 2,
    },
    totalInWordsValue: {
      fontSize: 9,
      color: muted,
    },
    footer: {
      marginTop: 24,
    },
    footerTitle: {
      fontSize: 9,
      fontWeight: 700,
      color: heading,
      marginBottom: 4,
    },
    footerText: {
      fontSize: 9,
      color: muted,
      lineHeight: 1.45,
      marginBottom: 10,
    },
    signature: {
      width: 120,
      height: 48,
      objectFit: "contain",
      marginTop: 8,
    },
    paymentDivider: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    paymentButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: accentColor,
      backgroundColor: darkMode ? pageBg : "#FFFFFF",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      textDecoration: "none",
      textAlign: "center",
    },
    paymentButtonText: {
      color: accentColor,
      fontSize: 10,
      fontWeight: 600,
      textAlign: "center",
    },
    paymentPaidText: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: border,
      fontSize: 10,
      fontWeight: 600,
      color: "#047857",
      textAlign: "right",
    },
  });
}

export function DefaultInvoicePdf({
  data,
  payment,
}: {
  data: InvoiceFormData;
  payment?: InvoicePdfPayment;
}) {
  const currency = data.invoiceDetails.currency;
  const subtotal = calculateSubtotal(data.items);
  const total = calculateInvoiceTotal(data);
  const reference = invoiceReference(data);
  const accentColor = data.invoiceDetails.theme.baseColor;
  const darkMode = data.invoiceDetails.theme.mode === "dark";
  const fontFamily = invoicePdfFontFamily(data.invoiceDetails.theme.font);
  const monoFamily = invoicePdfMonoFontFamily(data.invoiceDetails.theme.font);
  const styles = createStyles(fontFamily, monoFamily, accentColor, darkMode);
  const logo =
    data.companyDetails.logoBase64 || data.companyDetails.logo || undefined;
  const signature =
    data.companyDetails.signatureBase64 ||
    data.companyDetails.signature ||
    undefined;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.content}>
          <Text style={styles.title}>Invoice {reference}</Text>

          <View style={styles.headerRow}>
            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Serial Number</Text>
                <Text style={styles.metaValue}>
                  {data.invoiceDetails.serialNumber}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>
                  {formatInvoiceDate(data.invoiceDetails.date)}
                </Text>
              </View>
              {data.invoiceDetails.dueDate ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Due Date</Text>
                  <Text style={styles.metaValue}>
                    {formatInvoiceDate(data.invoiceDetails.dueDate)}
                  </Text>
                </View>
              ) : null}
              {data.invoiceDetails.paymentTerms ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Terms</Text>
                  <Text style={styles.metaValue}>
                    {data.invoiceDetails.paymentTerms}
                  </Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Currency</Text>
                <Text style={styles.metaValue}>{currency}</Text>
              </View>
            </View>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
          </View>

          <View style={styles.billingRow}>
            <View style={[styles.billingCard, styles.billingCardLeft]}>
              <Text style={styles.billingCardTitle}>Billed By</Text>
              <Text style={styles.billingName}>{data.companyDetails.name}</Text>
              {data.companyDetails.address ? (
                <Text style={styles.billingAddress}>
                  {data.companyDetails.address}
                </Text>
              ) : null}
              {data.companyDetails.metadata.map((row) => (
                <Text
                  key={`company-${row.label}-${row.value}`}
                  style={styles.billingAddress}
                >
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>

            <View style={styles.billingCard}>
              <Text style={styles.billingCardTitle}>Billed To</Text>
              <Text style={styles.billingName}>{data.clientDetails.name}</Text>
              {data.clientDetails.address ? (
                <Text style={styles.billingAddress}>
                  {data.clientDetails.address}
                </Text>
              ) : null}
              {data.clientDetails.metadata.map((row) => (
                <Text
                  key={`client-${row.label}-${row.value}`}
                  style={styles.billingAddress}
                >
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>Price</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
            </View>
            {data.items.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={[
                  styles.tableRow,
                  index === data.items.length - 1 ? styles.tableRowLast : {},
                ]}
              >
                <View style={styles.colItem}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  ) : null}
                </View>
                <Text style={[styles.colQty, styles.totalValue]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.colPrice, styles.totalValue]}>
                  {formatCurrency(item.unitPrice, currency)}
                </Text>
                <Text style={[styles.colTotal, styles.totalValue]}>
                  {formatCurrency(item.quantity * item.unitPrice, currency)}
                </Text>
              </View>
            ))}
          </View>

          {(data.metadata.notes ||
            data.metadata.terms ||
            data.metadata.paymentInformation.length > 0) && (
            <View style={styles.footer}>
              {data.metadata.paymentInformation.length > 0 ? (
                <View>
                  <Text style={styles.footerTitle}>Payment Information</Text>
                  {data.metadata.paymentInformation.map((row) => (
                    <Text key={row.label} style={styles.footerText}>
                      {row.label}: {row.value}
                    </Text>
                  ))}
                </View>
              ) : null}
              {data.metadata.notes ? (
                <View>
                  <Text style={styles.footerTitle}>Notes</Text>
                  <Text style={styles.footerText}>{data.metadata.notes}</Text>
                </View>
              ) : null}
              {data.metadata.terms ? (
                <View>
                  <Text style={styles.footerTitle}>Terms</Text>
                  <Text style={styles.footerText}>{data.metadata.terms}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.totalsBlock}>
            {signature ? (
              <View style={styles.signatureBlock}>
                <Text style={styles.signatureLabel}>
                  Verified by {data.companyDetails.name}
                </Text>
                <Image src={signature} style={styles.signature} />
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(subtotal, currency)}
              </Text>
            </View>
            {data.invoiceDetails.billingDetails.map((row) => (
              <View key={row.label} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {row.label}
                  {row.type === "percentage" ? ` (${row.value}%)` : ""}
                </Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(
                    row.type === "percentage"
                      ? subtotal * (row.value / 100)
                      : row.value,
                    currency,
                  )}
                </Text>
              </View>
            ))}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(total, currency)}
              </Text>
            </View>
            <Text style={styles.totalInWordsLabel}>Invoice Total (in words)</Text>
            <Text style={styles.totalInWordsValue}>{amountToWords(total)}</Text>

            {payment ? (
              payment.status === "paid" ? (
                <Text style={styles.paymentPaidText}>Paid</Text>
              ) : (
                <View style={styles.paymentDivider}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Payment due</Text>
                    <Text style={styles.totalValue}>
                      {payment.amount.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      {payment.tokenSymbol}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.totalInWordsValue,
                      { textAlign: "right", marginBottom: 0 },
                    ]}
                  >
                    {payment.networkLabel}
                  </Text>
                  <Link src={payment.url} style={styles.paymentButton}>
                    <Text style={styles.paymentButtonText}>Pay invoice</Text>
                  </Link>
                </View>
              )
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
