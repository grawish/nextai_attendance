// Copyright (c) 2023, Hybrowlabs Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('Photo', {
    refresh: function(frm) {
        frm.add_custom_button("Process Photo", function () {
            frm.call("process_photo").then(r=>{
                if(!r.exc){
                    frappe.show_alert({
                        message: "Photo processing queued successfully",
                        indicator: "green"
                    })
                } else {
                    console.error(r);
                }
            });
        });

        const wrapper = frm.get_field("preview").$wrapper;
        if (frm.is_new()) {
            wrapper.html("");
        } else {
            wrapper.html(`
				<div class="img_preview">
					<img class="img-responsive" src="/api/method/nextai_attendance.api.photo.photo?name=${frm.doc.name}&roi=true" alt="preview" />
				</div>
			`);
        }
    }
});
