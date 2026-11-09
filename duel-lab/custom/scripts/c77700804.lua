--呪われた宝箱
--Cursed Treasure Chest (original card)
--① "a monster that activated its effect this turn": the card is flagged when it activates a monster effect.
--  The flag lasts until the End Phase and survives moving from the hand/GY to the field (it is reset when the
--  card leaves the field or is turned face-down, as it is then a new card).
local s,id=GetID()
local SET_CURSED=0x7c7
function s.initial_effect(c)
	--① (Quick) target 1 face-up monster that activated its effect this turn: Special Summon this card from the hand,
	--   then equip that monster to this card
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_SPECIAL_SUMMON+CATEGORY_EQUIP)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetRange(LOCATION_HAND)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.sptg)
	e1:SetOperation(s.spop)
	c:RegisterEffect(e1)
	--② (Quick) during either player's Main Phase: equip 1 Level 4 Warrior monster from the Deck to this card
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_EQUIP)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetRange(LOCATION_MZONE)
	e2:SetHintTiming(0,TIMING_MAIN_END)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.mpcon)
	e2:SetTarget(s.deqtg)
	e2:SetOperation(s.deqop)
	c:RegisterEffect(e2)
	--③ (Ignition) target 1 monster on the field: Special Summon or add to the hand 1 monster card you control that is
	--   treated as an Equip Card, then equip the target to this card or send it to the GY
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,2))
	e3:SetCategory(CATEGORY_SPECIAL_SUMMON+CATEGORY_TOHAND+CATEGORY_EQUIP+CATEGORY_TOGRAVE)
	e3:SetType(EFFECT_TYPE_IGNITION)
	e3:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e3:SetRange(LOCATION_MZONE)
	e3:SetCountLimit(1,{id,2})
	e3:SetTarget(s.mvtg)
	e3:SetOperation(s.mvop)
	c:RegisterEffect(e3)
	if not s.global_check then
		s.global_check=true
		local ge=Effect.GlobalEffect()
		ge:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_CONTINUOUS)
		ge:SetCode(EVENT_CHAINING)
		ge:SetOperation(s.checkop)
		Duel.RegisterEffect(ge,0)
	end
end
s.listed_series={SET_CURSED}
function s.checkop(e,tp,eg,ep,ev,re,r,rp)
	if re:IsActiveType(TYPE_MONSTER) then
		re:GetHandler():RegisterFlagEffect(id,RESET_EVENT+RESET_LEAVE+RESET_TEMP_REMOVE+RESET_TURN_SET+RESET_PHASE+PHASE_END,0,1)
	end
end
--equip ec to tc; it stays equipped only to tc
function s.equip(owner,ec,tp,tc,step)
	if not Duel.Equip(tp,ec,tc,true,step) then return false end
	local e1=Effect.CreateEffect(owner)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_EQUIP_LIMIT)
	e1:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD)
	e1:SetLabelObject(tc)
	e1:SetValue(function(e,c) return c==e:GetLabelObject() end)
	ec:RegisterEffect(e1)
	return true
end
--a monster that can become an Equip Card (Tokens cannot)
function s.canequip(c)
	return not c:IsType(TYPE_TOKEN) and not c:IsForbidden()
end
function s.spfilter(c)
	return c:IsFaceup() and c:GetFlagEffect(id)>0 and s.canequip(c)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	local c=e:GetHandler()
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and s.spfilter(chkc) end
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and Duel.GetLocationCount(tp,LOCATION_SZONE)>0
		and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
		and Duel.IsExistingTarget(s.spfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
	local g=Duel.SelectTarget(tp,s.spfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,nil)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,c,1,0,0)
	Duel.SetOperationInfo(0,CATEGORY_EQUIP,g,1,0,0)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	if not c:IsRelateToEffect(e) or Duel.SpecialSummon(c,0,tp,tp,false,false,POS_FACEUP)==0 then return end
	if tc and tc:IsRelateToEffect(e) and tc:IsFaceup() and tc:IsLocation(LOCATION_MZONE) and s.canequip(tc)
		and Duel.GetLocationCount(tp,LOCATION_SZONE)>0 then
		s.equip(c,tc,tp,c)
	end
end
function s.mpcon(e,tp,eg,ep,ev,re,r,rp)
	local ph=Duel.GetCurrentPhase()
	return ph==PHASE_MAIN1 or ph==PHASE_MAIN2
end
function s.deqfilter(c)
	return c:IsRace(RACE_WARRIOR) and c:IsLevel(4) and c:IsMonster() and not c:IsForbidden()
end
function s.deqtg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_SZONE)>0
		and Duel.IsExistingMatchingCard(s.deqfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_EQUIP,nil,1,tp,LOCATION_DECK)
end
function s.deqop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not (c:IsRelateToEffect(e) and c:IsFaceup() and c:IsLocation(LOCATION_MZONE)) or Duel.GetLocationCount(tp,LOCATION_SZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
	local tc=Duel.SelectMatchingCard(tp,s.deqfilter,tp,LOCATION_DECK,0,1,1,nil):GetFirst()
	if tc then s.equip(c,tc,tp,c) end
end
--a monster card you control that is treated as an Equip Card
function s.eqcfilter(c,e,tp)
	if not (c:IsFaceup() and c:GetEquipTarget() and c:GetOriginalType()&TYPE_MONSTER~=0) then return false end
	return s.canss(c,e,tp) or s.canth(c)
end
function s.canss(c,e,tp)
	return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
--an Extra Deck monster would return to the Extra Deck, not to the hand
function s.canth(c)
	return c:GetOriginalType()&(TYPE_FUSION+TYPE_SYNCHRO+TYPE_XYZ+TYPE_LINK)==0 and c:IsAbleToHand()
end
function s.mvtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	local c=e:GetHandler()
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and chkc~=c end
	if chk==0 then return Duel.IsExistingTarget(nil,tp,LOCATION_MZONE,LOCATION_MZONE,1,c)
		and Duel.IsExistingMatchingCard(s.eqcfilter,tp,LOCATION_SZONE,0,1,nil,e,tp) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TARGET)
	Duel.SelectTarget(tp,nil,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,c)
end
function s.mvop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SELECT)
	local sc=Duel.SelectMatchingCard(tp,s.eqcfilter,tp,LOCATION_SZONE,0,1,1,nil,e,tp):GetFirst()
	if not sc then return end
	Duel.HintSelection(sc)
	local b1,b2=s.canss(sc,e,tp),s.canth(sc)
	local op
	if b1 and b2 then op=Duel.SelectOption(tp,aux.Stringid(id,3),aux.Stringid(id,4))
	elseif b1 then op=0 else op=1 end
	local done
	if op==0 then
		done=Duel.SpecialSummon(sc,0,tp,tp,false,false,POS_FACEUP)>0
	else
		done=Duel.SendtoHand(sc,nil,REASON_EFFECT)>0
		if done then Duel.ConfirmCards(1-tp,sc) end
	end
	if not done or not (tc and tc:IsRelateToEffect(e) and tc:IsLocation(LOCATION_MZONE)) then return end
	--then: equip the target to this card or send it to the GY
	local e1=c:IsRelateToEffect(e) and c:IsFaceup() and c:IsLocation(LOCATION_MZONE) and tc~=c and tc:IsFaceup()
		and s.canequip(tc) and Duel.GetLocationCount(tp,LOCATION_SZONE)>0
	local e2=tc:IsAbleToGrave()
	if not (e1 or e2) then return end
	local op2
	if e1 and e2 then op2=Duel.SelectOption(tp,aux.Stringid(id,5),aux.Stringid(id,6))
	elseif e1 then op2=0 else op2=1 end
	Duel.BreakEffect()
	if op2==0 then s.equip(c,tc,tp,c) else Duel.SendtoGrave(tc,REASON_EFFECT) end
end
