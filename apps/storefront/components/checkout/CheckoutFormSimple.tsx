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
  CheckoutError,
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
import { GraphQLErrors } from "@apollo/client/errors";

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
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);

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
    mode: "onBlur",
  });
  if (!checkout) {
    return null;
  }
  console.log(checkout);

  /**
   * Handles common Saleor/GQL errors
   */
  const handleGlobalErrors = (
    errors?: Partial<CheckoutError>[],
    gql_errors?: GraphQLErrors
  ): boolean => {
    const apiErrors = errors?.length ? errors.map((e) => e.message || "Unknown error") : [];
    const gqlErrors = gql_errors?.length ? gql_errors.map((e) => e.message || "Unknown error") : [];
    if (apiErrors || gqlErrors) {
      setIsPaymentProcessing(false);
      setGlobalErrors([...apiErrors, ...gqlErrors]);
    }
    return true;
  };
  /**
   * Handles Saleor response for particular fields
   */
  const handleFormErrors = (errors?: CheckoutError[], gql_errors?: GraphQLErrors): boolean => {
    if (errors?.length) {
      errors.forEach((e) =>
        setErrorAddress(e.field as keyof SimpleFormData, {
          message: e.message || "",
        })
      );
      setIsPaymentProcessing(false);
      return false;
    }
    if (gql_errors?.length) {
      setIsPaymentProcessing(false);
      return false;
    }
    return true;
  };

  /**
   * Main submit handler
   */

  const onSimpleFormSubmit = handleSubmitAddress(async (formData: SimpleFormData) => {
    const { email, ...addressData } = formData;

    setIsPaymentProcessing(true);

    // email
    const { data: emailData, errors: emailGQLErrors } = await checkoutEmailUpdate({
      variables: {
        email: email,
        token: checkout.token,
        locale: query.locale,
      },
    });
    const emailErrors = emailData?.checkoutEmailUpdate?.errors;

    if (!handleFormErrors(emailErrors, emailGQLErrors)) return;

    // Shipping Address
    const { data: shippingAddressData, errors: shippingGQLErrors } =
      await checkoutShippingAddressUpdate({
        variables: {
          address: {
            ...addressData,
          },
          token: checkout.token,
          locale: query.locale,
        },
      });
    const shippingAddressErrors = shippingAddressData?.checkoutShippingAddressUpdate?.errors;
    if (!handleFormErrors(shippingAddressErrors, shippingGQLErrors)) return;

    // Billing Address
    const { data: billingAddressData, errors: billingGQLErrors } =
      await checkoutBillingAddressUpdate({
        variables: {
          address: {
            ...addressData,
          },
          token: checkout.token,
          locale: query.locale,
        },
      });
    const billingAddressErrors = billingAddressData?.checkoutBillingAddressUpdate?.errors;
    if (!handleFormErrors(billingAddressErrors, billingGQLErrors)) return;

    const { data: shippingMethodData, errors: methodGQLErrors } =
      await checkoutShippingMethodUpdate({
        variables: {
          token: checkout.token,
          shippingMethodId: getShippingMethod(
            shippingAddressData?.checkoutShippingAddressUpdate?.checkout
          ).id,
          locale: query.locale,
        },
      });
    const shippingMethodErrors = shippingMethodData?.checkoutShippingMethodUpdate?.errors;
    if (!handleGlobalErrors(shippingMethodErrors, methodGQLErrors)) return;
    // Create Saleor payment
    const { data: paymentData, errors: paymentGQLErrors } = await checkoutPaymentCreateMutation({
      variables: {
        checkoutToken: checkout.token,
        paymentInput: {
          gateway: DUMMY_CREDIT_CARD_GATEWAY,
          amount: checkout.totalPrice?.gross.amount,
          token: defaultCard.cardNumber,
        },
      },
    });

    const paymentCreateErrors = paymentData?.checkoutPaymentCreate?.errors.map((e) => {
      return {
        message: e.message,
        field: e.field,
      };
    });
    if (!handleGlobalErrors(paymentCreateErrors, paymentGQLErrors)) return;

    // Try to complete the checkout
    const { data: completeData, errors: completeGQLErrors } = await checkoutCompleteMutation({
      variables: {
        checkoutToken: checkout.token,
      },
    });
    const completeErrors = completeData?.checkoutComplete?.errors;
    if (!handleGlobalErrors(completeErrors, completeGQLErrors)) return;

    const order = completeData?.checkoutComplete?.order;
    // If there are no errors during payment and confirmation, order should be created
    if (order) {
      return redirectToOrderDetailsPage();
    } else {
      setGlobalErrors([...globalErrors, "Sorry, unable to create order"]);
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

            <div className="col-span-full sm:col-span-6">
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
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,6}$/i,
                      message: "Incorrect email",
                    },
                  })}
                />
                {!!errorsAddress.email && <p>{errorsAddress.email.message || "error"}</p>}
              </div>
            </div>
            <div className="col-span-full sm:col-span-6">
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
                    minLength: {
                      value: 6,
                      message: "Too short", // JS only: <p>error message</p> TS only support string
                    },
                    pattern: {
                      value: /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/i,
                      message: "Incorrect format, please use +256-700-550197 or 0700-550197", // JS only: <p>error message</p> TS only support string
                    },
                  })}
                />
                {!!errorsAddress.phone && (
                  <p>{errorsAddress.phone.message || "Phone format error"}</p>
                )}
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
            {globalErrors.length ? (
              <div className="col-span-full mt-4 mb-4">
                <h2 className="text-3xl">Oops!</h2>
                {globalErrors.map((e) => (
                  <p className="my-4 text-base font-medium text-red-700">{e}</p>
                ))}
              </div>
            ) : (
              ""
            )}
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
