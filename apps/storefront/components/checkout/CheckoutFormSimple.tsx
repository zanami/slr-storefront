import React, { useState } from "react";

import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";

import { useRegions } from "@/components/RegionsProvider";
import { messages } from "@/components/translations";
import { usePaths } from "@/lib/paths";
import { useCheckout } from "@/lib/providers/CheckoutProvider";
import {
  CheckoutDetailsFragment,
  CountryCode,
  useCheckoutBillingAddressUpdateMutation,
  useCheckoutCompleteMutation,
  useCheckoutEmailUpdateMutation,
  useCheckoutPaymentCreateMutation,
  useCheckoutShippingAddressUpdateMutation,
  useCheckoutShippingMethodUpdateMutation,
} from "@/saleor/api";
import { notNullable } from "@/lib/util";
import { useUser } from "@/lib/useUser";

// import ShippingMethodDisplay from "./ShippingMethodDisplay";
import CompleteCheckoutButton from "./CompleteCheckoutButton";

export const DUMMY_CREDIT_CARD_GATEWAY = "mirumee.payments.dummy";

export interface SimpleFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: CountryCode;
  streetAddress1: string;
  city: string;
  postalCode: string;
}

export function CheckoutForm() {
  const { checkout, resetCheckoutToken } = useCheckout();
  const { query } = useRegions();
  const router = useRouter();
  const { user } = useUser();
  const [checkoutEmailUpdate] = useCheckoutEmailUpdateMutation({});
  const [checkoutPaymentCreateMutation] = useCheckoutPaymentCreateMutation();
  const [checkoutShippingAddressUpdate] = useCheckoutShippingAddressUpdateMutation({});
  const [checkoutCompleteMutation] = useCheckoutCompleteMutation();
  const [checkoutShippingMethodUpdate] = useCheckoutShippingMethodUpdateMutation({});
  const [checkoutBillingAddressUpdate] = useCheckoutBillingAddressUpdateMutation({});

  const paths = usePaths();
  const t = useIntl();

  const redirectToOrderDetailsPage = async () => {
    // without the `await` checkout data will be removed before the redirection which will cause issue with rendering checkout view
    await router.push(paths.order.$url());
    resetCheckoutToken();
  };

  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  const defaultCard = {
    cardNumber: "4242 4242 4242 4242",
    expDate: "12/34",
    cvc: "123",
  };

  const getShippingMethod = (checkout: CheckoutDetailsFragment | null | undefined) => {
    const availableShippingMethods = checkout?.availableShippingMethods.filter(notNullable) || [];
    // todo this is hardcoded
    return availableShippingMethods[0];
  };

  const selectedGateway = checkout?.availablePaymentGateways.filter(
    (g) => g.id === DUMMY_CREDIT_CARD_GATEWAY
  )[0];

  const existingAddressData = checkout?.shippingAddress;
  const availableAddress = user?.defaultShippingAddress;

  const defaultAddress: SimpleFormData = {
    email: checkout?.email || user?.email || "",
    firstName: existingAddressData?.firstName || availableAddress?.firstName || "",
    lastName: existingAddressData?.lastName || availableAddress?.lastName || "",
    phone: existingAddressData?.phone || availableAddress?.phone || "",
    country: "UG",
    streetAddress1: existingAddressData?.streetAddress1 || availableAddress?.streetAddress1 || "",
    city: existingAddressData?.city || availableAddress?.city || "",
    postalCode: existingAddressData?.postalCode || availableAddress?.postalCode || "",
  };

  const {
    register: registerAddress,
    handleSubmit: handleSubmitAddress,
    formState: { errors: errorsAddress },
    setError: setErrorAddress,
  } = useForm<SimpleFormData>({
    defaultValues: defaultAddress,
  });
  if (!checkout) {
    return null;
  }
  console.log(checkout);
  // main submit function

  const onSimpleFormSubmit = handleSubmitAddress(async (formData: SimpleFormData) => {
    const { email, ...addressData } = formData;

    setIsPaymentProcessing(true);

    const address_errors = await checkoutShippingAddressUpdate({
      variables: {
        address: {
          ...addressData,
        },
        token: checkout.token,
        locale: query.locale,
      },
    });
    const billing_errors = await checkoutBillingAddressUpdate({
      variables: {
        address: {
          ...addressData,
        },
        token: checkout.token,
        locale: query.locale,
      },
    });
    const email_errors = await checkoutEmailUpdate({
      variables: {
        email: email,
        token: checkout?.token,
        locale: query.locale,
      },
    });

    const { data } = await checkoutShippingMethodUpdate({
      variables: {
        token: checkout.token,
        shippingMethodId: getShippingMethod(
          address_errors.data?.checkoutShippingAddressUpdate?.checkout
        ).id,
        locale: query.locale,
      },
    });
    if (data?.checkoutShippingMethodUpdate?.errors.length) {
      // todo: handle errors
      console.error(data?.checkoutShippingMethodUpdate?.errors);
      return;
    }

    const errors = [
      ...(email_errors.data?.checkoutEmailUpdate?.errors.filter(notNullable) || []),
      ...(address_errors.data?.checkoutShippingAddressUpdate?.errors.filter(notNullable) || []),
      ...(billing_errors.data?.checkoutBillingAddressUpdate?.errors.filter(notNullable) || []),
    ];

    // Assign errors to the form fields
    if (errors.length > 0) {
      errors.forEach((e) =>
        setErrorAddress(e.field as keyof SimpleFormData, {
          message: e.message || "",
        })
      );
      return;
    }

    // Address updated, we can exit the edit mode
    // toggleEdit();

    // Create Saleor payment
    const { errors: paymentCreateErrors } = await checkoutPaymentCreateMutation({
      variables: {
        checkoutToken: checkout.token,
        paymentInput: {
          gateway: DUMMY_CREDIT_CARD_GATEWAY,
          amount: checkout.totalPrice?.gross.amount,
          token: defaultCard.cardNumber,
        },
      },
    });

    if (paymentCreateErrors) {
      console.error(paymentCreateErrors);
      setIsPaymentProcessing(false);
      return;
    }

    // Try to complete the checkout
    const { data: completeData, errors: completeErrors } = await checkoutCompleteMutation({
      variables: {
        checkoutToken: checkout.token,
      },
    });
    if (completeErrors) {
      console.error("complete errors:", completeErrors);
      setIsPaymentProcessing(false);
      return;
    }

    const order = completeData?.checkoutComplete?.order;
    // If there are no errors during payment and confirmation, order should be created
    if (order) {
      return redirectToOrderDetailsPage();
    } else {
      console.error("Order was not created");
    }
  });
  return (
    <section className="flex flex-auto flex-col overflow-y-auto px-4 pt-4 space-y-4 pb-4">
      <div className="checkout-section-container">
        <form method="post" onSubmit={onSimpleFormSubmit}>
          <div className="grid grid-cols-12 gap-4 w-full">
            <div className="col-span-full">
              <div className="mt-4 mb-4">
                <h2 className="text-3xl">Contact information</h2>
              </div>
            </div>

            <div className="col-span-6">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.emailAddressCardHeader)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="phone"
                  className="w-full border-gray-300 rounded-md shadow-sm text-base"
                  spellCheck={false}
                  {...registerAddress("email", {
                    required: true,
                    pattern: /^\S+@\S+$/i,
                  })}
                />
                {!!errorsAddress.phone && <p>{errorsAddress.phone.message || "error"}</p>}
              </div>
            </div>
            <div className="col-span-6">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.phoneField)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="phone"
                  className="w-full border-gray-300 rounded-md shadow-sm text-base"
                  spellCheck={false}
                  {...registerAddress("phone", {
                    required: true,
                    pattern: /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/i,
                  })}
                />
                {!!errorsAddress.phone && <p>{errorsAddress.phone.message || "error"}</p>}
              </div>
            </div>

            <div className="col-span-full sm:col-span-6">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.firstNameField)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="province"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  spellCheck={false}
                  {...registerAddress("firstName", {
                    required: true,
                  })}
                />
                {!!errorsAddress.firstName && <p>{errorsAddress.firstName.message}</p>}
              </div>
            </div>

            <div className="col-span-full sm:col-span-6">
              <label htmlFor="province" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.lastNameField)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="lastName"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  spellCheck={false}
                  {...registerAddress("lastName", {
                    required: true,
                  })}
                />
                {!!errorsAddress.lastName && <p>{errorsAddress.lastName.message}</p>}
              </div>
            </div>

            <div className="col-span-6">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.addressField)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="streetAddress1"
                  className="w-full border-gray-300 rounded-md shadow-sm text-base"
                  spellCheck={false}
                  {...registerAddress("streetAddress1", {
                    required: true,
                  })}
                />
                {!!errorsAddress.streetAddress1 && <p>{errorsAddress.streetAddress1.message}</p>}
              </div>
            </div>

            <div className="col-span-6">
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                {t.formatMessage(messages.cityField)}
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="city"
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-base"
                  spellCheck={false}
                  {...registerAddress("city", { required: true })}
                />
                {!!errorsAddress.city && <p>{errorsAddress.city.message}</p>}
              </div>
            </div>
            <div className="col-span-full">
              <div className="mt-4 mb-4">
                <h2 className="text-3xl">{t.formatMessage(messages.shippingMethodCardHeader)}</h2>
                <p className="mt-6 text-base font-medium text-gray-900">
                  Free local delivery on all orders.
                </p>
                {/* {!!checkout.shippingMethod ? (
                  <ShippingMethodDisplay method={checkout.shippingMethod} />
                ) : (
                  "Please fill in the address details"
                )} */}
              </div>
            </div>
            <div className="col-span-full">
              <div className="mt-4 mb-4">
                <h2 className="text-3xl">{t.formatMessage(messages.paymentCardHeader)}</h2>
                {!!selectedGateway && (
                  <p className="mt-6 text-base font-medium text-gray-900">
                    Cash or Mobile Money on delivery. We&apos;ll contact you shortly for further
                    details.
                  </p>
                  // <p className="mt-6 text-base font-medium text-gray-900">{selectedGateway.name}</p>
                )}
              </div>
            </div>
            <div className="col-span-full">
              <CompleteCheckoutButton
                isProcessing={isPaymentProcessing}
                isDisabled={isPaymentProcessing}
                onClick={onSimpleFormSubmit}
              >
                Order!
              </CompleteCheckoutButton>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

export default CheckoutForm;
