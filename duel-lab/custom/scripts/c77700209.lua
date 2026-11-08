--嵐気流－暴風圏
--Storm Flow - Cyclone (original card)
local s,id=GetID()
local SET_STORM_FLOW=0x7c1
local CARD_GUST_MAX=77700210
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Synchro Summon: 1 WIND Tuner + 1+ non-Tuner monsters
	Synchro.AddProcedure(c,aux.FilterBoolFunctionEx(Card.IsAttribute,ATTRIBUTE_WIND),1,1,Synchro.NonTuner(nil),1,99)
	--① Synchro Summoned, or your opponent activates an effect (once per chain):
	--return 1 WIND monster you control to hand/Extra Deck and 1 opponent card to hand
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_TOHAND)
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1:SetCondition(function(e) return e:GetHandler():IsSummonType(SUMMON_TYPE_SYNCHRO) and e:GetHandler():GetFlagEffect(id)==0 end)
	e1:SetTarget(s.rttg)
	e1:SetOperation(s.rtop)
	c:RegisterEffect(e1)
	local e1b=Effect.CreateEffect(c)
	e1b:SetDescription(aux.Stringid(id,0))
	e1b:SetCategory(CATEGORY_TOHAND)
	e1b:SetType(EFFECT_TYPE_QUICK_O)
	e1b:SetCode(EVENT_CHAINING)
	e1b:SetRange(LOCATION_MZONE)
	e1b:SetCondition(function(e,tp,eg,ep,ev,re,r,rp) return rp==1-tp and e:GetHandler():GetFlagEffect(id)==0 end)
	e1b:SetTarget(s.rttg)
	e1b:SetOperation(s.rtop)
	c:RegisterEffect(e1b)
	--② this card leaves the field because of the opponent: shuffle all monsters you control into the Deck, Special Summon "Storm Flow - Gust Max"
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_TODECK+CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e2:SetProperty(EFFECT_FLAG_DELAY)
	e2:SetCode(EVENT_LEAVE_FIELD)
	e2:SetCondition(s.gmcon)
	e2:SetTarget(s.gmtg)
	e2:SetOperation(s.gmop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_STORM_FLOW}
s.listed_names={CARD_GUST_MAX}
function s.ownfilter(c)
	return c:IsFaceup() and c:IsAttribute(ATTRIBUTE_WIND) and c:IsAbleToHand()
end
function s.rttg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.ownfilter,tp,LOCATION_MZONE,0,1,nil)
		and Duel.IsExistingMatchingCard(Card.IsAbleToHand,tp,0,LOCATION_ONFIELD,1,nil) end
	--once per chain
	e:GetHandler():RegisterFlagEffect(id,RESET_EVENT+RESETS_STANDARD+RESET_CHAIN,0,1)
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,2,PLAYER_ALL,LOCATION_ONFIELD)
end
function s.rtop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_RTOHAND)
	local tc=Duel.SelectMatchingCard(tp,s.ownfilter,tp,LOCATION_MZONE,0,1,1,nil):GetFirst()
	if not tc then return end
	Duel.HintSelection(tc)
	if Duel.SendtoHand(tc,nil,REASON_EFFECT)==0 or not tc:IsLocation(LOCATION_HAND+LOCATION_EXTRA) then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_RTOHAND)
	local g=Duel.SelectMatchingCard(tp,Card.IsAbleToHand,tp,0,LOCATION_ONFIELD,1,1,nil)
	if #g>0 then
		Duel.HintSelection(g)
		Duel.SendtoHand(g,nil,REASON_EFFECT)
	end
end
function s.gmcon(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	return c:IsPreviousLocation(LOCATION_MZONE) and c:IsPreviousControler(tp) and c:GetReasonPlayer()==1-tp
end
--the text Special Summons it from the Extra Deck without treating it as a Synchro Summon, so the revive limit is ignored
function s.gmfilter(c,e,tp,mg)
	return c:IsCode(CARD_GUST_MAX) and c:IsCanBeSpecialSummoned(e,0,tp,false,true) and Duel.GetLocationCountFromEx(tp,tp,mg,c)>0
end
function s.gmtg(e,tp,eg,ep,ev,re,r,rp,chk)
	local mg=Duel.GetFieldGroup(tp,LOCATION_MZONE,0)
	if chk==0 then return Duel.IsExistingMatchingCard(s.gmfilter,tp,LOCATION_EXTRA,0,1,nil,e,tp,mg) end
	Duel.SetOperationInfo(0,CATEGORY_TODECK,mg,#mg,0,0)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.gmop(e,tp,eg,ep,ev,re,r,rp)
	local mg=Duel.GetFieldGroup(tp,LOCATION_MZONE,0)
	if #mg>0 then Duel.SendtoDeck(mg,nil,SEQ_DECKSHUFFLE,REASON_EFFECT) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sc=Duel.SelectMatchingCard(tp,s.gmfilter,tp,LOCATION_EXTRA,0,1,1,nil,e,tp,nil):GetFirst()
	if sc then
		Duel.BreakEffect()
		Duel.SpecialSummon(sc,0,tp,tp,false,true,POS_FACEUP)
	end
end
