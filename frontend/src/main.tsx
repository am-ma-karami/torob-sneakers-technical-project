import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/manrope";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import "./theme.css";
import "./glass.css";
import { App } from "./App";
import { ComparisonProvider } from "./lib/comparison";
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: 1, refetchOnWindowFocus: false },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <ComparisonProvider>
            <App />
          </ComparisonProvider>
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
