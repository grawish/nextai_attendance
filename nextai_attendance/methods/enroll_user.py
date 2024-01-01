import frappe
import time
import json
import itertools
import face_recognition

@frappe.whitelist()
def enroll_user(**kwargs):
    images = json.loads(kwargs.get('images'))
    user = frappe.session.user
    user_exists = frappe.db.exists('Person',{'user':user})
    if user_exists:
        person = frappe.get_value('Person',{'user':user})
    else:
        person = frappe.new_doc('Person')
        person.user = user
        person.person_name = frappe.get_doc('User',user).full_name
        person.insert(ignore_permissions=True)

    for photo_name in images:
        photo=frappe.get_doc('Photo',{'photo':photo_name})
        if len(photo.people)>1:
            return {"error":"More than one faces detected,\nkindly re-upload!"}
        if len(photo.people)<1:
            return {"error": "No Face Detected,\nkindly re-upload!"}
        roi = frappe.get_doc('ROI', photo.people[0].face)
        roi.person = person
        roi.save(ignore_permissions=True)
    return True
