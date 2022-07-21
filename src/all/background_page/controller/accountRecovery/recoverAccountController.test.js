/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.6.0
 */

import {enableFetchMocks} from "jest-fetch-mock";
import each from "jest-each";
import app from "../../app";
import {User} from "../../model/user";
import {Keyring} from "../../model/keyring";
import {defaultApiClientOptions} from "../../service/api/apiClient/apiClientOptions.test.data";
import {RecoverAccountController} from "./recoverAccountController";
import {AccountAccountRecoveryEntity} from "../../model/entity/account/accountAccountRecoveryEntity";
import {defaultAccountAccountRecoveryDto} from "../../model/entity/account/accountAccountRecoveryEntity.test.data";
import {pgpKeys} from "../../../../../test/fixtures/pgpKeys/keys";
import {mockApiResponse} from "../../../../../test/mocks/mockApiResponse";
import {
  approvedAccountRecoveryRequestDto,
  approvedAccountRecoveryRequestWithoutPrivateKeyDto,
  approvedAccountRecoveryRequestWithoutResponsesDto
} from "../../model/entity/accountRecovery/accountRecoveryRequestEntity.test.data";
import {AccountLocalStorage} from "../../service/local_storage/accountLocalStorage";
import {InvalidMasterPasswordError} from "../../error/invalidMasterPasswordError";
import {readKeyOrFail} from "../../utils/openpgp/openpgpAssertions";

jest.mock("../../model/worker");

beforeEach(() => {
  enableFetchMocks();
});

describe("RecoverAccountController", () => {
  describe("RecoverAccountController::exec", () => {
    const accountRecovery = new AccountAccountRecoveryEntity(defaultAccountAccountRecoveryDto());
    const apiClientOptions = defaultApiClientOptions();
    const accountRecoveryRequestDto = approvedAccountRecoveryRequestDto({id: accountRecovery.accountRecoveryRequestId});
    const passphrase = pgpKeys.account_recovery_request.passphrase;

    it("Should perform the account recovery.", async() => {
      // Mock API fetch account recovery request get response.
      fetch.doMockOnce(() => mockApiResponse(accountRecoveryRequestDto));
      // Mock API complete request.
      fetch.doMockOnce(() => mockApiResponse());
      // Mock pagemods to assert the complete start the auth and inform menu pagemods.
      app.pageMods.WebIntegration.init = jest.fn();
      app.pageMods.AuthBootstrap.init = jest.fn();
      app.pageMods.PublicWebsiteSignIn.init = jest.fn();

      const controller = new RecoverAccountController(null, null, apiClientOptions, accountRecovery);
      await controller.exec(passphrase);

      expect.assertions(13);

      // The user account should have been configured (legacy).
      const user = User.getInstance().get();
      expect(user.id).toStrictEqual(accountRecovery.userId);
      expect(user.username).toStrictEqual(accountRecovery.username);
      expect(user.firstname).toStrictEqual(accountRecovery.firstName);
      expect(user.lastname).toStrictEqual(accountRecovery.lastName);
      expect(user.settings.domain).toStrictEqual(accountRecovery.domain);
      expect(user.settings.securityToken).toStrictEqual(accountRecovery.securityToken.toDto());

      // The keyring should contain the user recovered key.
      const keyring = new Keyring();
      const keyringPrivateKey = await readKeyOrFail(keyring.findPrivate().armoredKey);
      const userPublicKey = await readKeyOrFail(keyring.findPublic(accountRecovery.userId).armoredKey);
      const keyringPrivateKeyFingerprint = keyringPrivateKey.getFingerprint().toUpperCase();
      const userPublicKeyFingerprint = userPublicKey.getFingerprint().toUpperCase();

      expect(keyringPrivateKeyFingerprint).toStrictEqual(pgpKeys.ada.fingerprint);
      expect(userPublicKeyFingerprint).toStrictEqual(pgpKeys.ada.fingerprint);
      expect(userPublicKeyFingerprint).toStrictEqual(keyringPrivateKeyFingerprint);

      // The auth and web integration pagemods should have been initialized.
      expect(app.pageMods.WebIntegration.init).toHaveBeenCalled();
      expect(app.pageMods.AuthBootstrap.init).toHaveBeenCalled();
      expect(app.pageMods.PublicWebsiteSignIn.init).toHaveBeenCalled();

      // The account recovery should been removed from the account local storage.
      expect(await AccountLocalStorage.get()).toHaveLength(0);
    });

    each([
      {expectedError: "A passphrase is required.", passphrase: undefined},
      {expectedError: "The passphrase should be a string.", passphrase: 42}
    ]).describe("Should assert the signed-in user passphrase parameter.", scenario => {
      it(`Should validate the scenario: ${scenario.expectedError}`, async() => {
        const controller = new RecoverAccountController(null, null, apiClientOptions, accountRecovery);
        const promise = controller.exec(scenario.passphrase);
        expect.assertions(1);
        await expect(promise).rejects.toThrowError(scenario.expectedError);
      });
    });

    each([
      {expectedError: "The account recovery request id should match the request id associated to the account being recovered.", findRequestMock: approvedAccountRecoveryRequestDto()},
      {expectedError: "The account recovery request should have a private key.", findRequestMock: approvedAccountRecoveryRequestWithoutPrivateKeyDto({id: accountRecovery.accountRecoveryRequestId})},
      {expectedError: "The account recovery request should have a collection of responses.", findRequestMock: approvedAccountRecoveryRequestWithoutResponsesDto({id: accountRecovery.accountRecoveryRequestId})},
      {expectedError: "The account recovery request responses should contain exactly one response.", findRequestMock: approvedAccountRecoveryRequestDto({id: accountRecovery.accountRecoveryRequestId, account_recovery_responses: []})},
    ]).describe("Should assert the signed-in user passphrase parameter.", scenario => {
      it(`Should validate the scenario: ${scenario.expectedError}`, async() => {
        // Mock API fetch account recovery request get response.
        fetch.doMockOnce(() => mockApiResponse(scenario.findRequestMock));

        const controller = new RecoverAccountController(null, null, apiClientOptions, accountRecovery);
        const promise = controller.exec(passphrase);
        expect.assertions(1);
        await expect(promise).rejects.toThrowError(scenario.expectedError);
      });
    });

    it("Should assert the account recovery user private key can be decrypted.", async() => {
      // Mock API fetch account recovery request get response.
      fetch.doMockOnce(() => mockApiResponse(accountRecoveryRequestDto));

      const controller = new RecoverAccountController(null, null, apiClientOptions, accountRecovery);
      const promise = controller.exec("wrong passphrase");
      expect.assertions(1);
      await expect(promise).rejects.toThrowError(InvalidMasterPasswordError);
    });

    it("Should not add the account to the local storage if the complete API request fails.", async() => {
      const accountRecovery = new AccountAccountRecoveryEntity(defaultAccountAccountRecoveryDto());
      const accountRecoveryRequestDto = approvedAccountRecoveryRequestDto({id: accountRecovery.accountRecoveryRequestId});

      // Mock API fetch account recovery request get response.
      fetch.doMockOnce(() => mockApiResponse(accountRecoveryRequestDto));
      // Mock API complete request.
      fetch.doMockOnce(() => Promise.reject(new Error("Unable to complete the recover.")));

      const controller = new RecoverAccountController(null, null, apiClientOptions, accountRecovery);
      const promise = controller.exec(passphrase);

      expect.assertions(2);
      await expect(promise).rejects.toThrow("Unable to complete the recover.");
      expect(() => User.getInstance().get()).toThrow("The user is not set");
    });
  });
});
