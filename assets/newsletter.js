document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll("[data-newsletter-form]");

  for (const form of forms) {
    const emailInput = form.querySelector("[data-newsletter-email]");
    const submitButton = form.querySelector("[data-newsletter-submit]");
    const toast = form.querySelector("[data-newsletter-toast]");
    const toastMessage = form.querySelector("[data-newsletter-toast-message]");
    const toastSuccessIcon = form.querySelector(
      "[data-newsletter-toast-success]",
    );
    const endpoint = form.dataset.action || "/contact";

    if (!emailInput || !submitButton || !toast || !toastMessage) return;

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let toastTimeout = null;

    const showToast = (message, isSuccess) => {
      if (toastTimeout) clearTimeout(toastTimeout);

      toastMessage.textContent = message;

      if (toastSuccessIcon) {
        if (isSuccess) {
          toastSuccessIcon.classList.remove("hidden");
        } else {
          toastSuccessIcon.classList.add("hidden");
        }
      }

      toast.classList.remove(
        "hidden",
        "bg-error/5",
        "text-error",
        "bg-success/5",
        "text-success",
      );
      toast.classList.add("flex");

      if (isSuccess) {
        toast.classList.add("bg-success/5", "text-success");
      } else {
        toast.classList.add("bg-error/5", "text-error");
      }

      toastTimeout = setTimeout(() => {
        hideToast();
      }, 4000);
    };

    const hideToast = () => {
      toast.classList.add("hidden");
      toast.classList.remove(
        "flex",
        "bg-error/5",
        "text-error",
        "bg-success/5",
        "text-success",
      );
    };

    const setLoading = (isLoading) => {
      submitButton.disabled = isLoading;

      if (isLoading) {
        submitButton.classList.add("opacity-50", "cursor-not-allowed");
        submitButton.classList.remove("cursor-pointer");
      } else {
        submitButton.classList.remove("opacity-50", "cursor-not-allowed");
        submitButton.classList.add("cursor-pointer");
      }
    };

    const validateEmail = (email) => {
      return EMAIL_REGEX.test(email);
    };

    const handleSubmit = async () => {
      const email = emailInput.value.trim();

      if (!email) {
        showToast("Please enter your email address.", false);
        return;
      }

      if (!validateEmail(email)) {
        showToast("Please enter a valid email address.", false);
        return;
      }

      hideToast();
      setLoading(true);

      const formData = new FormData();
      for (const input of form.querySelectorAll("input[name]")) {
        formData.append(input.name, input.value);
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "text/html, application/xhtml+xml",
            "X-Requested-With": "XMLHttpRequest",
          },
          redirect: "manual",
        });

        if (
          response.type === "opaqueredirect" ||
          response.status === 302 ||
          response.status === 303
        ) {
          showToast("Thank you for subscribing!", true);
          emailInput.value = "";
        } else if (response.ok) {
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "text/html");
          const errorEl = doc.querySelector(
            ".errors, .form-error, [data-form-error], .error",
          );

          if (errorEl) {
            showToast(
              errorEl.textContent.trim() || "Something went wrong.",
              false,
            );
          } else {
            showToast("Thank you for subscribing!", true);
            emailInput.value = "";
          }
        } else if (response.status === 429) {
          showToast(
            "Too many requests. Please wait a moment and try again.",
            false,
          );
        } else {
          showToast("Something went wrong. Please try again.", false);
        }
      } catch {
        showToast("An error occurred. Please try again.", false);
      } finally {
        setLoading(false);
      }
    };

    submitButton.addEventListener("click", handleSubmit);

    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });

    emailInput.addEventListener("input", () => {
      if (
        toast.classList.contains("flex") &&
        validateEmail(emailInput.value.trim())
      ) {
        hideToast();
      }
    });
  }
});
