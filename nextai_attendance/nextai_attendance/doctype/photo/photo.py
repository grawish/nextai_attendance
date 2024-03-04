# Copyright (c) 2023, Hybrowlabs Technologies and contributors
# For license information, please see license.txt
from contextlib import suppress

import frappe
from frappe.exceptions import DuplicateEntryError
from frappe.model.document import Document


class Photo(Document):
    def validate(self):
        # TODO checklist:
        # - check if file type is supported
        # - extract and save image meta data
        # - probably parse and save as JSON which can be updated via the UI and written to the file
        pass

    def after_insert(self):
#         start processing etc, maybe via frappe.enqueue
        frappe.enqueue(
            "nextai_attendance.nextai_attendance.doctype.photo.photo.process_photo", queue="long", photo=self
        )

    @frappe.whitelist()
    def process_photo(self):
        # re-run process photo for whatever reason
        frappe.enqueue(
            "nextai_attendance.nextai_attendance.doctype.photo.photo.process_photo", queue="long", photo=self
        )


def process_photo(photo: Photo):
        import json

        import face_recognition
        import numpy as np
        from frappe.core.doctype.file.file import get_local_image

        people = []
        image, filename, extn = get_local_image(frappe.db.get_value("File",photo.photo, "file_url"))
        img=np.asarray(image)
        boxes = face_recognition.face_locations(img)
        encodings = face_recognition.face_encodings(img,boxes, num_jitters=100, model="large")

        for (encoding, location) in zip(encodings, boxes):
            roi = frappe.new_doc("ROI")
            roi.image = photo.photo
            roi.location = json.dumps(location)
            roi.encoding = json.dumps(encoding.tolist())
            with suppress(DuplicateEntryError):
                roi.insert(ignore_permissions=True)
                people.append(roi.name)

        for x in people:
            photo.append("people", {"face": x})

        photo.number_of_times_processed += 1
        photo.is_processed = True
        photo.save(ignore_permissions=True)
        frappe.publish_realtime(
            "refresh_photo", user=frappe.session.user, after_commit=True
        )
        # TODO: Show msgprint to user that photo has been processed

        return photo
