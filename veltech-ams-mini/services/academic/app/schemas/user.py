from datetime import datetime

from pydantic import BaseModel, Field, model_validator

class UserCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    email: str = Field(
        ...,
        min_length=3,
        max_length=200,
    )

    temporaryPassword: str = Field(
        ...,
        min_length=8,
        max_length=200,
    )

    role: str = "student"

    vtuNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    rollNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    gender: str | None = Field(
        default=None,
        max_length=30,
    )

    fatherName: str | None = Field(
        default=None,
        max_length=150,
    )

    motherName: str | None = Field(
        default=None,
        max_length=150,
    )

    dateOfBirth: str | None = Field(
        default=None,
        max_length=30,
    )

    degree: str | None = Field(
        default=None,
        max_length=100,
    )

    community: str | None = Field(
        default=None,
        max_length=100,
    )

    religion: str | None = Field(
        default=None,
        max_length=100,
    )

    nationality: str | None = Field(
        default=None,
        max_length=100,
    )

    aadhaarNumber: str | None = Field(
        default=None,
        max_length=20,
    )

    academicBankCreditsId: str | None = Field(
        default=None,
        max_length=50,
    )

    portalUsername: str | None = Field(
        default=None,
        max_length=100,
    )

    portalPassword: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    phoneNumber: str | None = Field(
        default=None,
        max_length=30,
    )

    parentName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentPhone: str | None = Field(
        default=None,
        max_length=30,
    )

    branch: str | None = Field(
        default=None,
        max_length=150,
    )

    year: str | None = None
    semester: str | None = None
    section: str | None = None
    batch: str | None = None

    photoUrl: str | None = None

    smsEnabled: bool = True
    notificationsEnabled: bool = True

    active: bool = True

    @model_validator(mode="after")
    def validate_portal_username(self):
        """
        AMS / Parent Portal username must be the VTU number
        when AMS credentials are provided.

        Example:

            vtuNumber      = VTU00000
            portalUsername = VTU00000

        Roll number remains separate:

            rollNumber = 23UECS1039

        AMS credentials themselves are optional during
        student creation.
        """

        if self.vtuNumber:

            vtu = (
                self.vtuNumber
                .strip()
            )

            self.vtuNumber = vtu

            if self.portalUsername:

                portal = (
                    self.portalUsername
                    .strip()
                )

                if portal != vtu:
                    raise ValueError(
                        "AMS/Parent Portal username "
                        "must be the VTU number."
                    )

                self.portalUsername = vtu

        elif self.portalUsername:

            self.portalUsername = (
                self.portalUsername
                .strip()
            )

        return self

class UserUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    email: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
    )

    vtuNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    rollNumber: str | None = Field(
        default=None,
        max_length=100,
    )

    gender: str | None = Field(
        default=None,
        max_length=30,
    )

    fatherName: str | None = Field(
        default=None,
        max_length=150,
    )

    motherName: str | None = Field(
        default=None,
        max_length=150,
    )

    dateOfBirth: str | None = Field(
        default=None,
        max_length=30,
    )

    degree: str | None = Field(
        default=None,
        max_length=100,
    )

    community: str | None = Field(
        default=None,
        max_length=100,
    )

    religion: str | None = Field(
        default=None,
        max_length=100,
    )

    nationality: str | None = Field(
        default=None,
        max_length=100,
    )

    aadhaarNumber: str | None = Field(
        default=None,
        max_length=20,
    )

    academicBankCreditsId: str | None = Field(
        default=None,
        max_length=50,
    )

    portalUsername: str | None = Field(
        default=None,
        max_length=100,
    )

    portalPassword: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    phoneNumber: str | None = Field(
        default=None,
        max_length=30,
    )

    parentName: str | None = Field(
        default=None,
        max_length=150,
    )

    parentPhone: str | None = Field(
        default=None,
        max_length=30,
    )

    branch: str | None = Field(
        default=None,
        max_length=150,
    )

    year: str | None = None
    semester: str | None = None
    section: str | None = None
    batch: str | None = None

    photoUrl: str | None = None

    smsEnabled: bool | None = None
    notificationsEnabled: bool | None = None

    active: bool | None = None

    @model_validator(mode="after")
    def validate_portal_username(self):
        """
        If both VTU number and portal username are supplied,
        they must match.

        UserService keeps the VTU number authoritative.
        """

        if self.vtuNumber:

            vtu = (
                self.vtuNumber
                .strip()
            )

            self.vtuNumber = vtu

            if self.portalUsername:

                portal = (
                    self.portalUsername
                    .strip()
                )

                if portal != vtu:
                    raise ValueError(
                        "AMS/Parent Portal username "
                        "must be the VTU number."
                    )

                self.portalUsername = vtu

        elif self.portalUsername:

            self.portalUsername = (
                self.portalUsername
                .strip()
            )

        return self

class ProfileUpdate(BaseModel):
    smsEnabled: bool | None = None
    notificationsEnabled: bool | None = None
    absentAlertsEnabled: bool | None = None

class PortalCredentialsUpdate(BaseModel):
    """
    Explicit AMS credential configuration.

    This schema is used by:

        PUT /profile/portal-credentials

    It is different from UserCreate.

    ---------------------------------------------------------
    UserCreate
    ---------------------------------------------------------

    AMS credentials are OPTIONAL.

    ---------------------------------------------------------
    PortalCredentialsUpdate
    ---------------------------------------------------------

    When the student/admin explicitly chooses to configure
    AMS, both username and password must be supplied.

    Example:

        portalUsername = VTU00000
        portalPassword = actual AMS password

    Parent Portal:

        username = VTU00000
        password = NOT REQUIRED

    The AMS password is NEVER returned to the frontend.
    """

    portalUsername: str | None = Field(
        default=None,
        max_length=100,
    )

    portalPassword: str = Field(
        ...,
        min_length=1,
        max_length=200,
    )

    @model_validator(mode="after")
    def normalize_username(self):
        if self.portalUsername:
            self.portalUsername = self.portalUsername.strip()
        return self

class PortalCredentialsPublic(BaseModel):
    configured: bool
    portalUsername: str | None = None

class UserPublic(BaseModel):
    photoDataUri: str | None = None
    emailIsInternalAlias: bool = False
    id: str

    name: str
    email: str
    role: str

    vtuNumber: str | None = None
    rollNumber: str | None = None

    gender: str | None = None
    fatherName: str | None = None
    motherName: str | None = None
    dateOfBirth: str | None = None
    degree: str | None = None
    community: str | None = None
    religion: str | None = None
    nationality: str | None = None

    aadhaarNumber: str | None = None
    academicBankCreditsId: str | None = None

    portalUsername: str | None = None

    portalCredentialsConfigured: bool = False

    phoneNumber: str | None = None
    parentName: str | None = None
    parentPhone: str | None = None

    branch: str | None = None
    year: str | None = None
    semester: str | None = None
    section: str | None = None
    batch: str | None = None

    photoUrl: str | None = None

    smsEnabled: bool = True
    notificationsEnabled: bool = True
    absentAlertsEnabled: bool = False

    active: bool = True
    forcePasswordChange: bool = False

    portalSynced: bool = False

    lastSyncedAt: datetime | None = None

    portalSyncInProgress: bool = False

    portalSyncLastError: str | None = None
