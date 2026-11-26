@IsTest
private class SfibaAttachmentControllerTest {
    @TestSetup
    static void accountData() {
        insert new SFIBA_Account__c(Name = 'Nord', SFIBA_Account_Key__c = '0017Q00000TsTdAQAV');
    }

    private static Id accountDataId() {
        return [SELECT Id FROM SFIBA_Account__c].Id;
    }

    private static Id upload(String name, Blob content) {
        ContentVersion version = new ContentVersion(
            Title = name,
            PathOnClient = name,
            VersionData = content,
            FirstPublishLocationId = accountDataId()
        );
        insert version;
        return [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id]
        .ContentDocumentId;
    }

    @IsTest
    static void assignsAPdfToItsSlotAndReplacesTheOldOne() {
        Id first = upload('first.pdf', Blob.valueOf('%PDF-1.4 a'));
        SfibaAttachmentController.Attachment attached = SfibaAttachmentController.assign(
            accountDataId(),
            3,
            first
        );
        Assert.areEqual(3, attached.slot);
        Assert.areEqual('first.pdf', attached.fileName);

        Id second = upload('second.pdf', Blob.valueOf('%PDF-1.4 b'));
        SfibaAttachmentController.assign(accountDataId(), 3, second);
        Map<Integer, SfibaAttachmentController.Attachment> all = SfibaAttachmentController.listAttachments(
            accountDataId()
        );
        Assert.areEqual(1, all.size());
        Assert.areEqual('second.pdf', all.get(3).fileName);
        Assert.areEqual(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :first]);
    }

    @IsTest
    static void refusesWhatIsNotAPdf() {
        Id document = upload('picture.png', Blob.valueOf('png'));
        try {
            SfibaAttachmentController.assign(accountDataId(), 1, document);
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
        Assert.areEqual(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :document]);
    }

    @IsTest
    static void storesTheLogoAndRemovesIt() {
        SfibaAttachmentController.Attachment logo = SfibaAttachmentController.uploadLogo(
            accountDataId(),
            'logo.jpg',
            EncodingUtil.base64Encode(Blob.valueOf('jpeg'))
        );
        Assert.areEqual(0, logo.slot);
        SfibaAttachmentController.uploadLogo(
            accountDataId(),
            'logo2.jpg',
            EncodingUtil.base64Encode(Blob.valueOf('jpeg2'))
        );
        Assert.areEqual(
            'logo2.jpg',
            SfibaAttachmentController.listAttachments(accountDataId()).get(0).fileName
        );
        SfibaAttachmentController.remove(accountDataId(), 0);
        Assert.isTrue(SfibaAttachmentController.listAttachments(accountDataId()).isEmpty());
    }

    @IsTest
    static void refusesUnknownSlots() {
        try {
            SfibaAttachmentController.remove(accountDataId(), 7);
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
    }

    private static String pdf(String text) {
        return EncodingUtil.base64Encode(Blob.valueOf('%PDF-1.7 ' + text));
    }

    @IsTest
    static void storesTheReportPdfOnTheAccountAsOneFileWithVersions() {
        Account account = new Account(Name = 'Nord');
        insert account;
        SFIBA_Account__c accountData = [SELECT Id FROM SFIBA_Account__c];
        accountData.SFIBA_Account__c = account.Id;
        update accountData;

        Id first = SfibaAttachmentController.saveReportPdf(
            accountData.Id,
            'IBA Report.pdf',
            pdf('1')
        );
        Id second = SfibaAttachmentController.saveReportPdf(
            accountData.Id,
            'IBA Report.pdf',
            pdf('2')
        );

        Assert.areEqual(first, second, 'a new version of the same file');
        Assert.areEqual(
            1,
            [
                SELECT COUNT()
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :account.Id AND ContentDocumentId = :first
            ]
        );
        ContentVersion latest = [
            SELECT VersionData, PathOnClient
            FROM ContentVersion
            WHERE ContentDocumentId = :first AND IsLatest = TRUE
        ];
        Assert.areEqual('%PDF-1.7 2', latest.VersionData.toString());
        Assert.areEqual('IBA Report.pdf', latest.PathOnClient);
        Assert.areEqual(2, [SELECT COUNT() FROM ContentVersion WHERE ContentDocumentId = :first]);
    }

    @IsTest
    static void storesTheReportPdfOnTheAccountDataWithoutAnAccount() {
        Id documentId = SfibaAttachmentController.saveReportPdf(accountDataId(), null, pdf('x'));
        Assert.areEqual(
            1,
            [
                SELECT COUNT()
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :accountDataId() AND ContentDocumentId = :documentId
            ]
        );
    }

    @IsTest
    static void refusesAnEmptyOrTooLargeReportPdf() {
        try {
            SfibaAttachmentController.saveReportPdf(accountDataId(), 'a.pdf', '');
            Assert.fail('empty PDF stored');
        } catch (AuraHandledException e) {
            Assert.isTrue(true);
        }
        SfibaAttachmentController.maxPdfBytes = 10;
        try {
            SfibaAttachmentController.saveReportPdf(
                accountDataId(),
                'a.pdf',
                pdf('more than ten bytes')
            );
            Assert.fail('too large PDF stored');
        } catch (AuraHandledException e) {
            Assert.isTrue(true);
        }
    }
}
