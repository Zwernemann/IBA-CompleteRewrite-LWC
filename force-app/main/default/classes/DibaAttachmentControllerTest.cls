@IsTest
private class DibaAttachmentControllerTest {
    @TestSetup
    static void plant() {
        insert new DIBA_Account__c(Name = 'Nord', Account_Key__c = '0017Q00000TsTdAQAV');
    }

    private static Id plantId() {
        return [SELECT Id FROM DIBA_Account__c].Id;
    }

    private static Id upload(String name, Blob content) {
        ContentVersion version = new ContentVersion(
            Title = name,
            PathOnClient = name,
            VersionData = content,
            FirstPublishLocationId = plantId()
        );
        insert version;
        return [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id]
        .ContentDocumentId;
    }

    @IsTest
    static void assignsAPdfToItsSlotAndReplacesTheOldOne() {
        Id first = upload('first.pdf', Blob.valueOf('%PDF-1.4 a'));
        DibaAttachmentController.Attachment attached = DibaAttachmentController.assign(
            plantId(),
            3,
            first
        );
        Assert.areEqual(3, attached.slot);
        Assert.areEqual('first.pdf', attached.fileName);

        Id second = upload('second.pdf', Blob.valueOf('%PDF-1.4 b'));
        DibaAttachmentController.assign(plantId(), 3, second);
        Map<Integer, DibaAttachmentController.Attachment> all = DibaAttachmentController.listAttachments(
            plantId()
        );
        Assert.areEqual(1, all.size());
        Assert.areEqual('second.pdf', all.get(3).fileName);
        Assert.areEqual(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :first]);
    }

    @IsTest
    static void refusesWhatIsNotAPdf() {
        Id document = upload('picture.png', Blob.valueOf('png'));
        try {
            DibaAttachmentController.assign(plantId(), 1, document);
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
        Assert.areEqual(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :document]);
    }

    @IsTest
    static void storesTheLogoAndRemovesIt() {
        DibaAttachmentController.Attachment logo = DibaAttachmentController.uploadLogo(
            plantId(),
            'logo.jpg',
            EncodingUtil.base64Encode(Blob.valueOf('jpeg'))
        );
        Assert.areEqual(0, logo.slot);
        DibaAttachmentController.uploadLogo(
            plantId(),
            'logo2.jpg',
            EncodingUtil.base64Encode(Blob.valueOf('jpeg2'))
        );
        Assert.areEqual(
            'logo2.jpg',
            DibaAttachmentController.listAttachments(plantId()).get(0).fileName
        );
        DibaAttachmentController.remove(plantId(), 0);
        Assert.isTrue(DibaAttachmentController.listAttachments(plantId()).isEmpty());
    }

    @IsTest
    static void refusesUnknownSlots() {
        try {
            DibaAttachmentController.remove(plantId(), 7);
            Assert.fail('rejected expected');
        } catch (AuraHandledException e) {
            Assert.isNotNull(e);
        }
    }
}
