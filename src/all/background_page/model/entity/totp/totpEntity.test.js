/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.5.0
 */
import EntityValidationError from "passbolt-styleguide/src/shared/models/entity/abstract/entityValidationError";
import EntitySchema from "passbolt-styleguide/src/shared/models/entity/abstract/entitySchema";
import TotpEntity from "./totpEntity";
import each from "jest-each";
import {defaultTotpDto} from "./totpDto.test.data";
import ExternalResourceEntity from "../resource/external/externalResourceEntity";
import {lowerCaseAlgorithmSetupTotpData} from "../mfa/mfaSetupTotpEntity.test.data";
import * as assertEntityProperty from "passbolt-styleguide/test/assert/assertEntityProperty";
import {defaultExternalResourceDto} from "../resource/external/externalResourceEntity.test.data";

describe("Totp entity", () => {
  describe("::getSchema", () => {
    it("schema must validate", () => {
      EntitySchema.validateSchema(TotpEntity.name, TotpEntity.getSchema());
    });

    it("validates secret_key property", () => {
      assertEntityProperty.string(TotpEntity, "secret_key");
      assertEntityProperty.minLength(TotpEntity, "secret_key", 1);
      assertEntityProperty.required(TotpEntity, "secret_key");
    });

    it("validates period property", () => {
      assertEntityProperty.integer(TotpEntity, "period");
      assertEntityProperty.minimum(TotpEntity, "period", 1);
      assertEntityProperty.required(TotpEntity, "period");
    });

    it("validates digits property", () => {
      assertEntityProperty.integer(TotpEntity, "digits");
      assertEntityProperty.minimum(TotpEntity, "digits", 6);
      assertEntityProperty.maximum(TotpEntity, "digits", 8);
      assertEntityProperty.required(TotpEntity, "digits");
    });

    it("validates algorithm property", () => {
      assertEntityProperty.string(TotpEntity, "algorithm");
      assertEntityProperty.enumeration(TotpEntity, "algorithm", ["SHA1", "SHA256", "SHA512"], ["RSA", "BASE64", "test"]);
      assertEntityProperty.required(TotpEntity, "algorithm");
    });
  });

  describe("::constructor", () => {
    it("constructor works if valid minimal DTO is provided", () => {
      expect.assertions(1);
      const dto = defaultTotpDto();
      const entity = new TotpEntity(dto);
      expect(entity.toDto()).toStrictEqual(dto);
    });

    it("constructor works if valid kdbx windows is provided", () => {
      expect.assertions(1);
      const fields = new Map();
      fields.set("TimeOtp-Secret-Base32", {getText: () => "OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA"});
      fields.set("TimeOtp-Algorithm", "HMAC-SHA-256");
      fields.set("TimeOtp-Length", "7");
      fields.set("TimeOtp-Period", "60");
      const entity = TotpEntity.createTotpFromKdbxWindows(fields);
      const dto = {
        secret_key: "OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA",
        period: 60,
        digits: 7,
        algorithm: "SHA256"
      };
      expect(entity.toDto()).toStrictEqual(dto);
    });

    describe("::marshal", () => {
      it("should sanitize the secret_key", () => {
        expect.assertions(1);
        const entity = new TotpEntity(defaultTotpDto({secret_key: " 572H +KBKéàùêB=_%$ "}));
        expect(entity.secretKey).toStrictEqual("572HKBKB");
      });

      it("Sanitising twice should give the same result", () => {
        expect.assertions(1);
        const entity = new TotpEntity(defaultTotpDto({secret_key: " 572H +KBKéàùêB=_%$ "}));
        const entity2 = new TotpEntity(entity.toDto());
        expect(entity2.secretKey).toStrictEqual("572HKBKB");
      });

      it("Sanitize valid DTO should remain the same", () => {
        expect.assertions(1);
        const entity = new TotpEntity(defaultTotpDto());
        expect(entity.secretKey).toStrictEqual(defaultTotpDto().secret_key);
      });
    });

    each([
      {scenario: 'empty dto', dto: {}},
      {scenario: 'secret key not base32', dto: defaultTotpDto({secret_key: " 871H KBKB "})},
      {scenario: 'digits is not valid', dto: defaultTotpDto({digits: 10})},
      {scenario: 'period is not valid', dto: defaultTotpDto({period: 0})},
      {scenario: 'algorithm is not valid', dto: defaultTotpDto({algorithm: "AAA"})},
    ]).describe("constructor returns validation error if dto is not valid", test => {
      it(`Should not validate: ${test.scenario}`, async() => {
        expect.assertions(1);
        expect(() => new TotpEntity(test.dto)).toThrow(EntityValidationError);
      });
    });
  });

  describe("::createTotpFromUrl", () => {
    it("CreateTotpFromUrl should work with lowercase algorithm", () => {
      const otpUrlData = lowerCaseAlgorithmSetupTotpData();
      const url = new URL(otpUrlData.otpProvisioningUri);
      expect(() => TotpEntity.createTotpFromUrl(url)).not.toThrow();
    });

    it("should works if valid url is provided", () => {
      expect.assertions(1);
      const url = new URL('otpauth://totp/pro.passbolt.local:admin@passbolt.com?issuer=pro.passbolt.local&secret=OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA');
      const entity = TotpEntity.createTotpFromUrl(url);
      const dto = {
        secret_key: "OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA",
        period: 30,
        digits: 6,
        algorithm: "SHA1"
      };
      expect(entity.toDto()).toStrictEqual(dto);
    });

    it("should works if valid url with all possible parameters is provided", () => {
      expect.assertions(1);
      const url = new URL('otpauth://totp/pro.passbolt.local:admin@passbolt.com?issuer=pro.passbolt.local&secret=OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA&period=60&digits=8&algorithm=SHA256');
      const entity = TotpEntity.createTotpFromUrl(url);
      const dto = {
        secret_key: "OFL3VF3OU4BZP45D4ZME6KTF654JRSSO4Q2EO6FJFGPKHRHYSVJA",
        period: 60,
        digits: 8,
        algorithm: "SHA256"
      };
      expect(entity.toDto()).toStrictEqual(dto);
    });
  });

  describe("::createUrlFromExternalResource", () => {
    it("should return a valid url from TOTP", () => {
      expect.assertions(2);
      const urlExpected = new URL('otpauth://totp/pro.passbolt.local%3Aadmin%40passbolt.com?secret=DAV3DS4ERAAF5QGH&issuer=pro.passbolt.local&algorithm=SHA1&digits=6&period=30');

      const entity = new TotpEntity(defaultTotpDto());
      const externalResourceDto = defaultExternalResourceDto({
        "name": "pro.passbolt.local",
        "username": "admin@passbolt.com",
        "uri": "pro.passbolt.local",
      });
      const externalResourceEntity = new ExternalResourceEntity(externalResourceDto);
      const url = entity.createUrlFromExternalResource(externalResourceEntity);
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toStrictEqual(urlExpected.href);
    });
  });
});
