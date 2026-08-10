import * as cdk from "aws-cdk-lib";
import { resolveParameters } from "../lib/parameter-schema";

describe("Parameter Handling Tests", () => {
  describe("Default Values", () => {
    test("resolves default values when no parameters specified", () => {
      // GIVEN - extracting parameters with nothing specified
      const parameters = resolveParameters({});

      // THEN - default parameters should be set correctly
      expect(parameters.cognitoSelfSignUpEnabled).toBe(true);
      expect(parameters.allowedIpV4AddressRanges).toEqual([
        "0.0.0.0/1",
        "128.0.0.0/1",
      ]);
      expect(parameters.allowedIpV6AddressRanges).toEqual([
        "0000:0000:0000:0000:0000:0000:0000:0000/1",
        "8000:0000:0000:0000:0000:0000:0000:0000/1",
      ]);
    });
  });

  describe("Parameter Overrides", () => {
    test("explicit parameters override default values", () => {
      // GIVEN - parameters with custom values
      const parameters = resolveParameters({
        cognitoSelfSignUpEnabled: false,
        allowedIpV4AddressRanges: ["192.168.0.0/16"],
      });

      // THEN - parameters should use provided values instead of defaults
      expect(parameters.cognitoSelfSignUpEnabled).toBe(false);
      expect(parameters.allowedIpV4AddressRanges).toEqual(["192.168.0.0/16"]);

      // Parameters not specified should still use defaults
      expect(parameters.allowedIpV6AddressRanges).toEqual([
        "0000:0000:0000:0000:0000:0000:0000:0000/1",
        "8000:0000:0000:0000:0000:0000:0000:0000/1",
      ]);
    });
  });

  describe("Context Parameters", () => {
    test("context parameters override defaults", () => {
      // GIVEN - app with context parameters
      const app = new cdk.App({
        context: {
          "rapid.cognitoSelfSignUpEnabled": false,
        },
      });

      // WHEN - context parameters are extracted directly
      const selfSignUpEnabled = app.node.tryGetContext(
        "rapid.cognitoSelfSignUpEnabled"
      );

      // THEN - value should come from context
      expect(selfSignUpEnabled).toBe(false);
    });

    test("context parameters are handled by resolveParameters", () => {
      // GIVEN - an object representing extracted context parameters
      const contextParams = {
        cognitoSelfSignUpEnabled: false,
        allowedIpV4AddressRanges: ["10.0.0.0/8"],
      };

      // WHEN - resolveParameters is called with these context params
      const parameters = resolveParameters(contextParams);

      // THEN - resolved parameters should include the context values
      expect(parameters.cognitoSelfSignUpEnabled).toBe(false);
      expect(parameters.allowedIpV4AddressRanges).toEqual(["10.0.0.0/8"]);
    });
  });
});

// PR02-3: defaultModelId ∈ availableModels の synth 時 fail-fast。
describe("defaultModelId must be selectable from availableModels (PR02-3)", () => {
  test("rejects a defaultModelId that is not in availableModels", () => {
    expect(() =>
      resolveParameters({
        defaultModelId: "not.in.the.list",
        availableModels: [{ modelId: "a.model", displayName: "A" }],
      })
    ).toThrow(/not in availableModels/);
  });

  test("accepts when availableModels is empty (model selector hidden)", () => {
    const parameters = resolveParameters({
      defaultModelId: "any.model",
      availableModels: [],
    });
    expect(parameters.defaultModelId).toBe("any.model");
  });
});
