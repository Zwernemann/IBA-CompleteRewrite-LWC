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
}
