export function triggerPrint({ delay = 400, url = null, useNewWindow = false } = {}) {
  if (typeof window === "undefined") return;

  const printNow = () => {
    try {
      window.focus();
      window.print();
    } catch (error) {
      console.error("Failed to trigger print", error);
    }
  };

  const run = () => {
    if (url) {
      if (useNewWindow) {
        const printWindow = window.open(url, "_blank", "noopener,noreferrer,width=1024,height=960");
        if (!printWindow) {
          window.location.assign(url);
          return;
        }
        const attemptPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (error) {
            console.error("Failed to trigger print in popup", error);
          }
        };
        printWindow.addEventListener("load", attemptPrint, { once: true });
        window.setTimeout(attemptPrint, 800);
        return;
      }

      window.location.assign(url);
      return;
    }

    printNow();
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.setTimeout(run, delay));
  } else {
    window.setTimeout(run, delay);
  }
}

export function openPrintableBill(billId) {
  if (!billId) return;
  triggerPrint({ url: `/billing?id=${billId}&print=1`, useNewWindow: true, delay: 200 });
}
