import type { Metadata } from "next";
import CRMApp from "./crm-app";

export const metadata: Metadata = {
  title: "Cursor CRM",
  description: "Заявки, оплаты и мотивация отдела продаж в одном окне",
};

export default function Home() {
  return <CRMApp />;
}
